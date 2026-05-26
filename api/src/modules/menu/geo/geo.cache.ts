import { cache } from '../../../shared/redis/redis'

// Cache Redis pra geo. TTL = 7 dias (compatível com o cache atual do
// geocoding.service.ts:171-184). Chaves prefixadas com `geo:` pra não colidir
// com o cache antigo do Google (que usa `geocode:` / `cep:`).

const TTL_SECONDS = 60 * 60 * 24 * 7

function normalizeText(s: string | undefined | null): string {
  return (s ?? '').trim().toLowerCase()
}

/** Chave determinística pra geocode (texto → coord). */
export function geocodeKey(input: {
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
}): string {
  const parts = [
    normalizeText(input.street),
    normalizeText(input.number),
    normalizeText(input.neighborhood),
    normalizeText(input.city),
    normalizeText(input.state),
  ].join('|')
  return `geo:geocode:${parts}`
}

/** Chave de reverse — arredonda em 5 casas (≈1m) pra evitar fragmentação. */
export function reverseKey(lat: number, lon: number): string {
  return `geo:reverse:${lat.toFixed(5)}:${lon.toFixed(5)}`
}

/** Chave de autocomplete — query normalizada + bias opcional. */
export function autocompleteKey(q: string, lat?: number, lon?: number): string {
  const biased = lat !== undefined && lon !== undefined
    ? `${lat.toFixed(2)}:${lon.toFixed(2)}`
    : 'no-bias'
  return `geo:auto:${normalizeText(q)}:${biased}`
}

/** Chave de rota — coordenadas truncadas. Rotas mudam pouco com pequenos deltas. */
export function routeKey(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): string {
  const f = `${from.latitude.toFixed(5)},${from.longitude.toFixed(5)}`
  const t = `${to.latitude.toFixed(5)},${to.longitude.toFixed(5)}`
  return `geo:route:${f}:${t}`
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    return await cache.get<T>(key)
  } catch {
    return null
  }
}

export async function setCached(key: string, value: unknown, ttl = TTL_SECONDS): Promise<void> {
  try {
    await cache.set(key, value, ttl)
  } catch {
    // Redis off — não bloqueia o retorno do provider.
  }
}
