// Testes do serviço de lookup de CEP.
// - Google primário: filtra por country=BR + postal_code, parseia
//   address_components e contabiliza cota.
// - ViaCEP fallback: usado se Google não trouxer resultado (sem key, network
//   down, ZERO_RESULTS ou resposta sem cidade/UF).

jest.mock('../../../shared/redis/redis', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
}))

jest.mock('../geocoding-usage.service', () => ({
  incrementGeocodingUsage: jest.fn(),
}))

import { cache } from '../../../shared/redis/redis'
import { lookupCep } from '../cep-lookup.service'
import { incrementGeocodingUsage } from '../geocoding-usage.service'

const mockCache = cache as jest.Mocked<typeof cache>
const mockIncrement = incrementGeocodingUsage as jest.MockedFunction<
  typeof incrementGeocodingUsage
>

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

function notOk(status = 500) {
  return { ok: false, status, json: async () => ({}) } as unknown as Response
}

const ORIGINAL_FETCH = global.fetch

const GOOGLE_OK_BODY = {
  status: 'OK',
  results: [
    {
      address_components: [
        { long_name: 'Avenida Paulista', short_name: 'Av. Paulista', types: ['route'] },
        { long_name: 'Bela Vista', short_name: 'Bela Vista', types: ['sublocality_level_1', 'sublocality', 'political'] },
        { long_name: 'São Paulo', short_name: 'São Paulo', types: ['administrative_area_level_2', 'political'] },
        { long_name: 'São Paulo', short_name: 'SP', types: ['administrative_area_level_1', 'political'] },
        { long_name: 'Brasil', short_name: 'BR', types: ['country', 'political'] },
        { long_name: '01310-100', short_name: '01310-100', types: ['postal_code'] },
      ],
    },
  ],
}

describe('lookupCep — Google primário', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    process.env.GOOGLE_GEOCODING_API_KEY = 'test-key'
    process.env.GOOGLE_GEOCODING_BASE_URL = 'https://maps.test/geocode'
    process.env.VIACEP_BASE_URL = 'https://viacep.test'
    ;(mockCache.get as jest.Mock).mockResolvedValue(null)
    ;(mockCache.set as jest.Mock).mockResolvedValue(undefined)
    mockIncrement.mockResolvedValue(undefined)
  })

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH
  })

  it('retorna endereço da Google quando status=OK', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok(GOOGLE_OK_BODY)) as unknown as typeof fetch

    const result = await lookupCep('01310-100')

    expect(result).toEqual({
      cep: '01310100',
      street: 'Avenida Paulista',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      source: 'google',
    })
    expect(mockIncrement).toHaveBeenCalledTimes(1)
    // Confere component filter
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('country%3ABR')
    expect(url).toContain('postal_code%3A01310100')
  })

  it('rejeita CEP com formato inválido (menos de 8 dígitos)', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch

    await expect(lookupCep('123')).rejects.toMatchObject({ status: 422, message: 'CEP inválido' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('normaliza CEP removendo máscara antes de consultar', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok(GOOGLE_OK_BODY)) as unknown as typeof fetch

    await lookupCep('01310-100')
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('postal_code%3A01310100')
  })

  it('usa cache quando disponível (sem fetch, sem incremento)', async () => {
    ;(mockCache.get as jest.Mock).mockResolvedValue({
      cep: '01310100',
      street: 'Cached',
      neighborhood: 'X',
      city: 'Y',
      state: 'SP',
      source: 'google',
    })
    global.fetch = jest.fn() as unknown as typeof fetch

    const result = await lookupCep('01310-100')
    expect(result.street).toBe('Cached')
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockIncrement).not.toHaveBeenCalled()
  })
})

describe('lookupCep — fallback ViaCEP', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    process.env.GOOGLE_GEOCODING_API_KEY = 'test-key'
    process.env.GOOGLE_GEOCODING_BASE_URL = 'https://maps.test/geocode'
    process.env.VIACEP_BASE_URL = 'https://viacep.test'
    ;(mockCache.get as jest.Mock).mockResolvedValue(null)
    ;(mockCache.set as jest.Mock).mockResolvedValue(undefined)
    mockIncrement.mockResolvedValue(undefined)
  })

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH
  })

  it('cai em ViaCEP quando Google retorna ZERO_RESULTS', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(ok({ status: 'ZERO_RESULTS', results: [] }))
      .mockResolvedValueOnce(
        ok({
          cep: '39560-000',
          logradouro: '',
          bairro: '',
          localidade: 'Salinas',
          uf: 'MG',
        })
      )
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await lookupCep('39560-000')

    expect(result).toEqual({
      cep: '39560000',
      street: '',
      neighborhood: '',
      city: 'Salinas',
      state: 'MG',
      source: 'viacep',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect((fetchMock.mock.calls[1][0] as string)).toContain('viacep.test/ws/39560000/json/')
    expect(mockIncrement).toHaveBeenCalledTimes(1) // Google ZERO_RESULTS conta
  })

  it('cai em ViaCEP quando Google retorna sem cidade/UF', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        ok({
          status: 'OK',
          results: [{ address_components: [{ long_name: 'BR', short_name: 'BR', types: ['country'] }] }],
        })
      )
      .mockResolvedValueOnce(
        ok({ logradouro: 'R', bairro: 'B', localidade: 'Salinas', uf: 'MG' })
      )
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await lookupCep('39560000')
    expect(result.source).toBe('viacep')
    expect(result.city).toBe('Salinas')
  })

  it('cai em ViaCEP quando Google falha em rede', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(ok({ logradouro: 'R', bairro: 'B', localidade: 'X', uf: 'SP' }))
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await lookupCep('01310100')
    expect(result.source).toBe('viacep')
    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('lança 422 quando Google e ViaCEP falham', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(ok({ status: 'ZERO_RESULTS', results: [] }))
      .mockResolvedValueOnce(ok({ erro: true }))
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(lookupCep('00000000')).rejects.toMatchObject({ status: 422, message: 'CEP não encontrado' })
  })

  it('pula Google e vai direto pro ViaCEP quando GOOGLE_GEOCODING_API_KEY não está set', async () => {
    delete process.env.GOOGLE_GEOCODING_API_KEY
    const fetchMock = jest
      .fn()
      .mockResolvedValue(ok({ logradouro: 'R', bairro: 'B', localidade: 'X', uf: 'SP' }))
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await lookupCep('01310100')
    expect(result.source).toBe('viacep')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0][0] as string)).toContain('viacep.test')
    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('lança 422 quando ViaCEP retorna HTTP erro e Google falhou', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(ok({ status: 'ZERO_RESULTS', results: [] }))
      .mockResolvedValueOnce(notOk(500))
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(lookupCep('00000000')).rejects.toMatchObject({ status: 422 })
  })
})
