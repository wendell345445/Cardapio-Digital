// Testes do serviço de geocoding (Nominatim).
// Mocka fetch + cache. Valida normalização de input, envio do User-Agent e
// comportamentos de erro (não encontrado, provider indisponível).

jest.mock('../../../shared/redis/redis', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
}))

import { cache } from '../../../shared/redis/redis'
import { geocodeAddress, reverseGeocode } from '../geocoding.service'

const mockCache = cache as jest.Mocked<typeof cache>

// Helper para montar uma Response-like mínima para o mock do fetch
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

describe('geocodeAddress (Nominatim)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
    // garantimos provider default
    process.env.GEOCODING_PROVIDER = 'nominatim'
    process.env.NOMINATIM_BASE_URL = 'https://nominatim.test'
    process.env.NOMINATIM_USER_AGENT = 'TestApp/1.0 (test@example.com)'
    ;(mockCache.get as jest.Mock).mockResolvedValue(null)
    ;(mockCache.set as jest.Mock).mockResolvedValue(undefined)
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('retorna lat/lng quando Nominatim responde com hit', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok([{ lat: '-23.5505', lon: '-46.6333', display_name: 'Av. Paulista, 1000' }])
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
      displayName: 'Av. Paulista, 1000',
    })

    // Conferir que chamou o endpoint certo, com User-Agent e montando a query
    const callArgs = (global.fetch as jest.Mock).mock.calls[0]
    expect(callArgs[0]).toContain('https://nominatim.test/search?')
    expect(callArgs[0]).toContain('format=json')
    expect(callArgs[1].headers['User-Agent']).toBe('TestApp/1.0 (test@example.com)')
  })

  it('envia query com partes preenchidas separadas por vírgula', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      ok([{ lat: '-23.5', lon: '-46.6' }])
    )
    global.fetch = fetchMock as unknown as typeof fetch

    await geocodeAddress({
      street: 'Rua A',
      number: '123',
      neighborhood: 'Centro',
      city: 'São Paulo',
    })

    const url = fetchMock.mock.calls[0][0] as string
    // URLSearchParams serializa espaço como `+`; normaliza antes de comparar
    const decoded = decodeURIComponent(url.replace(/\+/g, '%20'))
    expect(decoded).toContain('Rua A, 123')
    expect(decoded).toContain('Centro')
    expect(decoded).toContain('São Paulo')
    expect(decoded).toContain('Brasil')
  })

  it('usa cache quando disponível e não chama fetch', async () => {
    ;(mockCache.get as jest.Mock).mockResolvedValue({
      latitude: -1,
      longitude: -2,
      displayName: 'cached',
    })
    global.fetch = jest.fn() as unknown as typeof fetch

    const result = await geocodeAddress({ cep: '01310-100', street: 'Av. Paulista', number: '1000' })

    expect(result).toEqual({ latitude: -1, longitude: -2, displayName: 'cached' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('salva no cache após resposta do provider', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok([{ lat: '-23.55', lon: '-46.63' }])
    ) as unknown as typeof fetch

    await geocodeAddress({ street: 'Rua X', number: '1' })

    expect(mockCache.set).toHaveBeenCalledTimes(1)
    const [, payload, ttl] = (mockCache.set as jest.Mock).mock.calls[0]
    expect(payload).toMatchObject({ latitude: -23.55, longitude: -46.63 })
    expect(ttl).toBeGreaterThan(0)
  })

  it('lança 422 quando Nominatim retorna array vazio', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok([])) as unknown as typeof fetch

    await expect(
      geocodeAddress({ street: 'Rua inexistente', number: '9999' })
    ).rejects.toMatchObject({ status: 422, message: 'Endereço não encontrado' })
  })

  it('lança 503 quando fetch joga (network down)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch

    await expect(
      geocodeAddress({ street: 'Rua X', number: '1' })
    ).rejects.toMatchObject({ status: 503 })
  })

  it('lança 503 quando fetch retorna HTTP não-OK', async () => {
    global.fetch = jest.fn().mockResolvedValue(notOk(500)) as unknown as typeof fetch

    await expect(
      geocodeAddress({ street: 'Rua X', number: '1' })
    ).rejects.toMatchObject({ status: 503 })
  })

  it('lança 422 quando lat/lng da resposta não são números', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok([{ lat: 'nao-eh-numero', lon: 'abc' }])
    ) as unknown as typeof fetch

    await expect(
      geocodeAddress({ street: 'Rua X', number: '1' })
    ).rejects.toMatchObject({ status: 422 })
  })

  it('lança 422 quando input está totalmente vazio', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch

    await expect(geocodeAddress({})).rejects.toMatchObject({ status: 422 })
    // default `country=Brasil` só é usado se alguma outra parte existir; com tudo vazio
    // a query fica vazia e o service lança antes de chamar fetch
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('reverseGeocode (Nominatim)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
    process.env.GEOCODING_PROVIDER = 'nominatim'
    process.env.NOMINATIM_BASE_URL = 'https://nominatim.test'
    process.env.NOMINATIM_USER_AGENT = 'TestApp/1.0 (test@example.com)'
    ;(mockCache.get as jest.Mock).mockResolvedValue(null)
    ;(mockCache.set as jest.Mock).mockResolvedValue(undefined)
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('chama /reverse com lat+lon e retorna displayName', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      ok({ display_name: 'Av. Paulista, 1000 - Bela Vista, São Paulo', lat: '-23.5', lon: '-46.6' })
    )
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await reverseGeocode(-23.5505, -46.6333)

    expect(result.latitude).toBe(-23.5505)
    expect(result.longitude).toBe(-46.6333)
    expect(result.displayName).toBe('Av. Paulista, 1000 - Bela Vista, São Paulo')

    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('/reverse?')
    expect(url).toContain('lat=-23.5505')
    expect(url).toContain('lon=-46.6333')
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
  })

  it('lança 422 quando Nominatim retorna error', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      ok({ error: 'Unable to geocode' })
    ) as unknown as typeof fetch

    await expect(reverseGeocode(-23.5505, -46.6333)).rejects.toMatchObject({ status: 422 })
  })

  it('lança 503 quando fetch joga', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('net')) as unknown as typeof fetch

    await expect(reverseGeocode(-23.5505, -46.6333)).rejects.toMatchObject({ status: 503 })
  })
})
