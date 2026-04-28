// Testes do contador mensal da cota Google Geocoding.
// Mocka o cliente Redis direto (não usa o helper `cache` porque precisa de
// INCR/EXPIRE em pipeline).

const mockExec = jest.fn()
const mockExpire = jest.fn(() => ({ exec: mockExec }))
const mockIncrPipeline = jest.fn(() => ({ expire: mockExpire }))
const mockMulti = jest.fn(() => ({ incr: mockIncrPipeline }))
const mockGet = jest.fn()

jest.mock('../../../shared/redis/redis', () => ({
  getRedis: () => ({
    multi: mockMulti,
    get: mockGet,
  }),
}))

import {
  currentMonthKey,
  getGeocodingUsage,
  incrementGeocodingUsage,
} from '../geocoding-usage.service'

describe('currentMonthKey', () => {
  it('formata YYYY-MM em UTC com mês zero-padded', () => {
    expect(currentMonthKey(new Date('2026-04-28T12:00:00Z'))).toBe('2026-04')
    expect(currentMonthKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01')
    expect(currentMonthKey(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12')
  })
})

describe('incrementGeocodingUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExec.mockResolvedValue([])
  })

  it('faz INCR + EXPIRE em pipeline na chave do mês corrente', async () => {
    await incrementGeocodingUsage(new Date('2026-04-28T00:00:00Z'))

    expect(mockMulti).toHaveBeenCalledTimes(1)
    expect(mockIncrPipeline).toHaveBeenCalledWith('geocoding:usage:2026-04')
    expect(mockExpire).toHaveBeenCalledWith('geocoding:usage:2026-04', 35 * 24 * 60 * 60)
    expect(mockExec).toHaveBeenCalledTimes(1)
  })
})

describe('getGeocodingUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.GOOGLE_GEOCODING_MONTHLY_QUOTA
  })

  it('retorna used=0/percent=0 quando chave inexistente', async () => {
    mockGet.mockResolvedValue(null)

    const usage = await getGeocodingUsage(new Date('2026-04-28T00:00:00Z'))
    expect(usage).toEqual({ used: 0, quota: 10000, percent: 0, month: '2026-04' })
  })

  it('calcula percent corretamente em 70% e 100%', async () => {
    mockGet.mockResolvedValue('7000')
    let usage = await getGeocodingUsage(new Date('2026-04-28T00:00:00Z'))
    expect(usage.used).toBe(7000)
    expect(usage.percent).toBe(70)

    mockGet.mockResolvedValue('10000')
    usage = await getGeocodingUsage(new Date('2026-04-28T00:00:00Z'))
    expect(usage.percent).toBe(100)
  })

  it('clampa percent em 100 quando used > quota', async () => {
    mockGet.mockResolvedValue('15000')
    const usage = await getGeocodingUsage(new Date('2026-04-28T00:00:00Z'))
    expect(usage.used).toBe(15000)
    expect(usage.percent).toBe(100)
  })

  it('respeita GOOGLE_GEOCODING_MONTHLY_QUOTA quando setada', async () => {
    process.env.GOOGLE_GEOCODING_MONTHLY_QUOTA = '50000'
    mockGet.mockResolvedValue('5000')
    const usage = await getGeocodingUsage(new Date('2026-04-28T00:00:00Z'))
    expect(usage.quota).toBe(50000)
    expect(usage.percent).toBe(10)
  })

  it('aplica default 10000 quando env é inválida', async () => {
    process.env.GOOGLE_GEOCODING_MONTHLY_QUOTA = 'abc'
    mockGet.mockResolvedValue('1000')
    const usage = await getGeocodingUsage(new Date('2026-04-28T00:00:00Z'))
    expect(usage.quota).toBe(10000)
  })

  it('retorna 0/quota quando Redis lança (não derruba o admin)', async () => {
    mockGet.mockRejectedValue(new Error('redis down'))
    const usage = await getGeocodingUsage(new Date('2026-04-28T00:00:00Z'))
    expect(usage).toEqual({ used: 0, quota: 10000, percent: 0, month: '2026-04' })
  })
})
