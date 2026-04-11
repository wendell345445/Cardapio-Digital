import Redis from 'ioredis'

let client: Redis | null = null

export function getRedis(): Redis {
  if (!client) {
    throw new Error('Redis not connected. Call connectRedis() first.')
  }
  return client
}

export async function connectRedis(): Promise<void> {
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  })

  client.on('error', (err) => console.error('Redis error:', err))
  client.on('connect', () => console.log('✅ Redis connected'))

  await client.ping()
}

// ─── TTL defaults ──────────────────────────────────────────────────────────────
const TTL = {
  MENU: 5 * 60,       // 5 min
  STORE: 10 * 60,     // 10 min
  FEATURES: 10 * 60,  // 10 min
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const value = await getRedis().get(key)
    if (!value) return null
    return JSON.parse(value) as T
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value)
    if (ttlSeconds) {
      await getRedis().setex(key, ttlSeconds, serialized)
    } else {
      await getRedis().set(key, serialized)
    }
  },

  async del(key: string): Promise<void> {
    await getRedis().del(key)
  },

  async setMenu(storeId: string, value: unknown): Promise<void> {
    await cache.set(`menu:${storeId}`, value, TTL.MENU)
  },

  async setStore(storeId: string, value: unknown): Promise<void> {
    await cache.set(`store:${storeId}`, value, TTL.STORE)
  },

  async setFeatures(storeId: string, value: unknown): Promise<void> {
    await cache.set(`features:${storeId}`, value, TTL.FEATURES)
  },

  async invalidateStore(storeId: string): Promise<void> {
    await Promise.all([
      cache.del(`menu:${storeId}`),
      cache.del(`store:${storeId}`),
      cache.del(`features:${storeId}`),
    ])
  },
}
