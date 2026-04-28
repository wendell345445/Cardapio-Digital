// Testes do serviço de geocoding (Google Geocoding API).
// Mocka fetch + cache + contador de uso. Valida montagem da query, parse da
// resposta da Google, comportamentos de erro (ZERO_RESULTS, REQUEST_DENIED,
// network down) e contabilização da cota só nos status faturáveis.

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
import { incrementGeocodingUsage } from '../geocoding-usage.service'
import {
  geocodeAddress,
  primeGeocodeCacheFromManual,
  reverseGeocode,
} from '../geocoding.service'

const mockCache = cache as jest.Mocked<typeof cache>
const mockIncrement = incrementGeocodingUsage as jest.MockedFunction<
  typeof incrementGeocodingUsage
>

function ok(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response
}

function notOk(status = 500) {
  return {
    ok: false,
    status,
    json: async () => ({}),
  } as unknown as Response
}

const ORIGINAL_FETCH = global.fetch

describe('geocodeAddress (Google)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    process.env.GOOGLE_GEOCODING_API_KEY = 'test-key'
    process.env.GOOGLE_GEOCODING_BASE_URL = 'https://maps.test/geocode'
    ;(mockCache.get as jest.Mock).mockResolvedValue(null)
    ;(mockCache.set as jest.Mock).mockResolvedValue(undefined)
    mockIncrement.mockResolvedValue(undefined)
  })

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH
  })

  it('retorna lat/lng e formatted_address quando Google responde OK', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok({
        status: 'OK',
        results: [
          {
            formatted_address: 'Av. Paulista, 1000 - São Paulo',
            geometry: { location: { lat: -23.5505, lng: -46.6333 } },
          },
        ],
      })
    ) as unknown as typeof fetch

    const result = await geocodeAddress({
      cep: '01310-100',
      street: 'Av. Paulista',
      number: '1000',
      city: 'São Paulo',
      state: 'SP',
    })

    expect(result).toEqual({
      latitude: -23.5505,
      longitude: -46.6333,
      displayName: 'Av. Paulista, 1000 - São Paulo',
    })

    const callArgs = (global.fetch as jest.Mock).mock.calls[0]
    expect(callArgs[0]).toContain('https://maps.test/geocode?')
    expect(callArgs[0]).toContain('key=test-key')
    expect(callArgs[0]).toContain('region=br')
    expect(callArgs[0]).toContain('language=pt-BR')
    expect(mockIncrement).toHaveBeenCalledTimes(1)
  })

  it('serializa endereço completo na query `address`', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      ok({
        status: 'OK',
        results: [{ geometry: { location: { lat: -23.5, lng: -46.6 } } }],
      })
    )
    global.fetch = fetchMock as unknown as typeof fetch

    await geocodeAddress({
      street: 'Rua A',
      number: '123',
      neighborhood: 'Centro',
      city: 'São Paulo',
    })

    const url = fetchMock.mock.calls[0][0] as string
    const decoded = decodeURIComponent(url.replace(/\+/g, '%20'))
    expect(decoded).toContain('Rua A, 123')
    expect(decoded).toContain('Centro')
    expect(decoded).toContain('São Paulo')
    expect(decoded).toContain('Brasil')
  })

  it('usa cache quando disponível e não chama fetch nem incrementa cota', async () => {
    ;(mockCache.get as jest.Mock).mockResolvedValue({
      latitude: -1,
      longitude: -2,
      displayName: 'cached',
    })
    global.fetch = jest.fn() as unknown as typeof fetch

    const result = await geocodeAddress({
      cep: '01310-100',
      street: 'Av. Paulista',
      number: '1000',
    })

    expect(result).toEqual({ latitude: -1, longitude: -2, displayName: 'cached' })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('salva no cache após resposta OK do Google', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok({
        status: 'OK',
        results: [{ geometry: { location: { lat: -23.55, lng: -46.63 } } }],
      })
    ) as unknown as typeof fetch

    await geocodeAddress({ street: 'Rua X', number: '1' })

    expect(mockCache.set).toHaveBeenCalledTimes(1)
    const [, payload, ttl] = (mockCache.set as jest.Mock).mock.calls[0]
    expect(payload).toMatchObject({ latitude: -23.55, longitude: -46.63 })
    expect(ttl).toBeGreaterThan(0)
  })

  it('lança 422 e CONTABILIZA quando Google retorna ZERO_RESULTS (Google cobra)', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok({ status: 'ZERO_RESULTS', results: [] })
    ) as unknown as typeof fetch

    await expect(
      geocodeAddress({ street: 'Rua inexistente', number: '9999' })
    ).rejects.toMatchObject({ status: 422, message: 'Endereço não encontrado' })
    expect(mockIncrement).toHaveBeenCalledTimes(1)
  })

  it('lança 503 e NÃO contabiliza quando Google retorna REQUEST_DENIED', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok({ status: 'REQUEST_DENIED', results: [] })
    ) as unknown as typeof fetch

    await expect(
      geocodeAddress({ street: 'Rua X', number: '1' })
    ).rejects.toMatchObject({ status: 503 })
    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('lança 503 e NÃO contabiliza quando fetch joga (network down)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch

    await expect(
      geocodeAddress({ street: 'Rua X', number: '1' })
    ).rejects.toMatchObject({ status: 503 })
    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('lança 503 quando fetch retorna HTTP não-OK', async () => {
    global.fetch = jest.fn().mockResolvedValue(notOk(500)) as unknown as typeof fetch

    await expect(
      geocodeAddress({ street: 'Rua X', number: '1' })
    ).rejects.toMatchObject({ status: 503 })
    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('lança 422 quando lat/lng da resposta não são números', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok({
        status: 'OK',
        results: [{ geometry: { location: { lat: 'nope', lng: 'abc' } } }],
      })
    ) as unknown as typeof fetch

    await expect(
      geocodeAddress({ street: 'Rua X', number: '1' })
    ).rejects.toMatchObject({ status: 422 })
  })

  it('lança 422 quando input está totalmente vazio (não chama fetch)', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch

    await expect(geocodeAddress({})).rejects.toMatchObject({ status: 422 })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('lança 503 quando GOOGLE_GEOCODING_API_KEY não está configurada', async () => {
    delete process.env.GOOGLE_GEOCODING_API_KEY
    global.fetch = jest.fn() as unknown as typeof fetch

    await expect(
      geocodeAddress({ street: 'Rua X', number: '1' })
    ).rejects.toMatchObject({ status: 503 })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('primeGeocodeCacheFromManual', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(mockCache.set as jest.Mock).mockResolvedValue(undefined)
  })

  it('grava as coords manuais no cache com a mesma chave do geocode automático', async () => {
    await primeGeocodeCacheFromManual(
      { cep: '39560-000', street: 'Rua Das Orquídeas', number: '83', city: 'Salinas', state: 'MG' },
      { latitude: -16.17, longitude: -42.29 }
    )

    expect(mockCache.set).toHaveBeenCalledTimes(1)
    const [key, payload, ttl] = (mockCache.set as jest.Mock).mock.calls[0]
    expect(key).toMatch(/^geocode:/)
    expect(payload).toEqual({ latitude: -16.17, longitude: -42.29 })
    expect(ttl).toBeGreaterThan(0)
  })

  it('próximo geocode com mesmo endereço sai do cache (sem chamar Google)', async () => {
    // Sequência: prime → geocode (cache hit, sem fetch)
    let stored: unknown = null
    ;(mockCache.set as jest.Mock).mockImplementation(async (_k, v) => {
      stored = v
    })
    ;(mockCache.get as jest.Mock).mockImplementation(async () => stored)
    process.env.GOOGLE_GEOCODING_API_KEY = 'test-key'
    process.env.GOOGLE_GEOCODING_BASE_URL = 'https://maps.test/geocode'
    global.fetch = jest.fn() as unknown as typeof fetch

    await primeGeocodeCacheFromManual(
      { cep: '39560-000', street: 'Rua A', city: 'Salinas', state: 'MG' },
      { latitude: -16.0, longitude: -42.0 }
    )

    const result = await geocodeAddress({
      cep: '39560-000',
      street: 'Rua A',
      city: 'Salinas',
      state: 'MG',
    })

    expect(result).toEqual({ latitude: -16.0, longitude: -42.0 })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('não quebra se Redis estiver indisponível', async () => {
    ;(mockCache.set as jest.Mock).mockRejectedValue(new Error('redis down'))

    await expect(
      primeGeocodeCacheFromManual(
        { city: 'X', state: 'SP' },
        { latitude: -23, longitude: -46 }
      )
    ).resolves.toBeUndefined()
  })
})

describe('reverseGeocode (Google)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    process.env.GOOGLE_GEOCODING_API_KEY = 'test-key'
    process.env.GOOGLE_GEOCODING_BASE_URL = 'https://maps.test/geocode'
    ;(mockCache.get as jest.Mock).mockResolvedValue(null)
    ;(mockCache.set as jest.Mock).mockResolvedValue(undefined)
    mockIncrement.mockResolvedValue(undefined)
  })

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH
  })

  it('chama Google com latlng e retorna formatted_address', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      ok({
        status: 'OK',
        results: [
          {
            formatted_address: 'Av. Paulista, 1000 - Bela Vista, São Paulo',
            geometry: { location: { lat: -23.55, lng: -46.63 } },
          },
        ],
      })
    )
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await reverseGeocode(-23.5505, -46.6333)

    expect(result.latitude).toBe(-23.5505)
    expect(result.longitude).toBe(-46.6333)
    expect(result.displayName).toBe('Av. Paulista, 1000 - Bela Vista, São Paulo')

    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('latlng=-23.5505%2C-46.6333')
    expect(url).toContain('key=test-key')
    expect(mockIncrement).toHaveBeenCalledTimes(1)
  })

  it('usa cache quando disponível (arredondado em 5 casas)', async () => {
    ;(mockCache.get as jest.Mock).mockResolvedValue({
      latitude: -23.5505,
      longitude: -46.6333,
      displayName: 'cached-rev',
    })
    global.fetch = jest.fn() as unknown as typeof fetch

    const result = await reverseGeocode(-23.5505, -46.6333)

    expect(result.displayName).toBe('cached-rev')
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('lança 422 quando Google retorna ZERO_RESULTS', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok({ status: 'ZERO_RESULTS', results: [] })
    ) as unknown as typeof fetch

    await expect(reverseGeocode(-23.5505, -46.6333)).rejects.toMatchObject({ status: 422 })
    expect(mockIncrement).toHaveBeenCalledTimes(1)
  })

  it('lança 503 quando fetch joga', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('net')) as unknown as typeof fetch

    await expect(reverseGeocode(-23.5505, -46.6333)).rejects.toMatchObject({ status: 503 })
    expect(mockIncrement).not.toHaveBeenCalled()
  })
})
