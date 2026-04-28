import { getRedis } from '../../shared/redis/redis'

// Contador mensal de chamadas faturáveis à Google Geocoding API.
// Espelha o que o Google cobra: incrementa só quando a Google retorna OK ou
// ZERO_RESULTS. Cache hit local, network error ou REQUEST_DENIED não contam.
//
// Chave Redis: `geocoding:usage:YYYY-MM`. TTL de ~35 dias garante que o contador
// some naturalmente após a virada do mês — não há reset manual.
//
// Default da quota: 10.000 (free tier do Google em abril/2026). Configurável via
// `GOOGLE_GEOCODING_MONTHLY_QUOTA`.

const USAGE_KEY_TTL_SECONDS = 60 * 60 * 24 * 35 // 35 dias
const DEFAULT_MONTHLY_QUOTA = 10_000

export interface GeocodingUsage {
  used: number
  quota: number
  percent: number
  month: string // YYYY-MM (UTC)
}

export function currentMonthKey(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

function usageKey(month: string): string {
  return `geocoding:usage:${month}`
}

function monthlyQuota(): number {
  const raw = process.env.GOOGLE_GEOCODING_MONTHLY_QUOTA
  if (!raw) return DEFAULT_MONTHLY_QUOTA
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MONTHLY_QUOTA
  return parsed
}

export async function incrementGeocodingUsage(now: Date = new Date()): Promise<void> {
  const key = usageKey(currentMonthKey(now))
  const redis = getRedis()
  // INCR + EXPIRE em pipeline. O EXPIRE roda toda vez (idempotente) — barato e
  // garante que mesmo a primeira chave de um mês recebe TTL imediatamente.
  await redis.multi().incr(key).expire(key, USAGE_KEY_TTL_SECONDS).exec()
}

export async function getGeocodingUsage(now: Date = new Date()): Promise<GeocodingUsage> {
  const month = currentMonthKey(now)
  let used = 0
  try {
    const raw = await getRedis().get(usageKey(month))
    if (raw) {
      const parsed = Number.parseInt(raw, 10)
      if (Number.isFinite(parsed) && parsed >= 0) used = parsed
    }
  } catch {
    // Redis indisponível: reporta 0/quota ao invés de quebrar o admin
  }

  const quota = monthlyQuota()
  const percent = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0
  return { used, quota, percent, month }
}
