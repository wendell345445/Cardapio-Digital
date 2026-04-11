import { getRedis } from '../../shared/redis/redis'

// ─── TASK-0911: AI Rate Limit (5 msg/hora por número) ────────────────────────

const MAX_MESSAGES_PER_HOUR = 5
const WINDOW_SECONDS = 3600

function rateKey(storeId: string, phone: string): string {
  return `ai:rate:${storeId}:${phone}`
}

export async function checkRateLimit(
  storeId: string,
  phone: string
): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRedis()
  const key = rateKey(storeId, phone)
  const current = await redis.get(key)
  const count = current ? parseInt(current, 10) : 0

  if (count >= MAX_MESSAGES_PER_HOUR) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: MAX_MESSAGES_PER_HOUR - count }
}

export async function incrementRateLimit(storeId: string, phone: string): Promise<void> {
  const redis = getRedis()
  const key = rateKey(storeId, phone)
  const current = await redis.get(key)

  if (!current) {
    await redis.set(key, '1', 'EX', WINDOW_SECONDS)
  } else {
    await redis.incr(key)
  }
}
