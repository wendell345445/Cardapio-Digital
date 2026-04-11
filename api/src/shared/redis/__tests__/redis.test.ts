// TASK-004: Redis e Configuração de Cache
export {}

const mockGet = jest.fn()
const mockSet = jest.fn()
const mockSetex = jest.fn()
const mockDel = jest.fn()
const mockPing = jest.fn().mockResolvedValue('PONG')
const mockOn = jest.fn()

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockGet,
    set: mockSet,
    setex: mockSetex,
    del: mockDel,
    ping: mockPing,
    on: mockOn,
  }))
})

// Reset module registry so we get a fresh singleton each describe
beforeEach(() => {
  jest.resetModules()
  mockGet.mockReset()
  mockSet.mockReset()
  mockSetex.mockReset()
  mockDel.mockReset()
})

describe('connectRedis', () => {
  it('connects using REDIS_URL env var', async () => {
    process.env.REDIS_URL = 'redis://custom-host:6380'
    const Redis = require('ioredis')
    const { connectRedis } = require('../redis')
    await connectRedis()
    expect(Redis).toHaveBeenCalledWith('redis://custom-host:6380', expect.any(Object))
    expect(mockPing).toHaveBeenCalled()
    delete process.env.REDIS_URL
  })

  it('defaults to redis://localhost:6379 when REDIS_URL is not set', async () => {
    delete process.env.REDIS_URL
    const Redis = require('ioredis')
    const { connectRedis } = require('../redis')
    await connectRedis()
    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', expect.any(Object))
  })
})

describe('getRedis', () => {
  it('throws before connectRedis is called', () => {
    jest.resetModules()
    const { getRedis } = require('../redis')
    expect(() => getRedis()).toThrow('Redis not connected')
  })

  it('returns the client after connectRedis', async () => {
    jest.resetModules()
    const { connectRedis, getRedis } = require('../redis')
    await connectRedis()
    expect(getRedis()).toBeDefined()
  })
})

describe('cache helpers', () => {
  let cache: typeof import('../redis')['cache']

  beforeEach(async () => {
    jest.resetModules()
    const redis = require('../redis')
    await redis.connectRedis()
    cache = redis.cache
  })

  describe('cache.get', () => {
    it('returns null when key does not exist', async () => {
      mockGet.mockResolvedValue(null)
      const result = await cache.get('missing-key')
      expect(result).toBeNull()
      expect(mockGet).toHaveBeenCalledWith('missing-key')
    })

    it('parses and returns JSON value', async () => {
      mockGet.mockResolvedValue(JSON.stringify({ id: '1', name: 'Pizza' }))
      const result = await cache.get<{ id: string; name: string }>('product:1')
      expect(result).toEqual({ id: '1', name: 'Pizza' })
    })
  })

  describe('cache.set', () => {
    it('stores value without TTL using SET', async () => {
      mockSet.mockResolvedValue('OK')
      await cache.set('key', { value: 42 })
      expect(mockSet).toHaveBeenCalledWith('key', JSON.stringify({ value: 42 }))
      expect(mockSetex).not.toHaveBeenCalled()
    })

    it('stores value with TTL using SETEX', async () => {
      mockSetex.mockResolvedValue('OK')
      await cache.set('key', { value: 42 }, 300)
      expect(mockSetex).toHaveBeenCalledWith('key', 300, JSON.stringify({ value: 42 }))
      expect(mockSet).not.toHaveBeenCalled()
    })
  })

  describe('cache.del', () => {
    it('deletes a key', async () => {
      mockDel.mockResolvedValue(1)
      await cache.del('some-key')
      expect(mockDel).toHaveBeenCalledWith('some-key')
    })
  })

  describe('cache.setMenu', () => {
    it('stores with key menu:{storeId} and TTL 300s', async () => {
      mockSetex.mockResolvedValue('OK')
      await cache.setMenu('store-abc', [{ id: '1' }])
      expect(mockSetex).toHaveBeenCalledWith(
        'menu:store-abc',
        300,
        JSON.stringify([{ id: '1' }])
      )
    })
  })

  describe('cache.setStore', () => {
    it('stores with key store:{storeId} and TTL 600s', async () => {
      mockSetex.mockResolvedValue('OK')
      await cache.setStore('store-abc', { name: 'Pizzaria' })
      expect(mockSetex).toHaveBeenCalledWith(
        'store:store-abc',
        600,
        JSON.stringify({ name: 'Pizzaria' })
      )
    })
  })

  describe('cache.setFeatures', () => {
    it('stores with key features:{storeId} and TTL 600s', async () => {
      mockSetex.mockResolvedValue('OK')
      await cache.setFeatures('store-abc', { delivery: true })
      expect(mockSetex).toHaveBeenCalledWith(
        'features:store-abc',
        600,
        JSON.stringify({ delivery: true })
      )
    })
  })

  describe('cache.invalidateStore', () => {
    it('deletes menu, store and features keys for the storeId', async () => {
      mockDel.mockResolvedValue(1)
      await cache.invalidateStore('store-abc')
      expect(mockDel).toHaveBeenCalledWith('menu:store-abc')
      expect(mockDel).toHaveBeenCalledWith('store:store-abc')
      expect(mockDel).toHaveBeenCalledWith('features:store-abc')
      expect(mockDel).toHaveBeenCalledTimes(3)
    })
  })
})
