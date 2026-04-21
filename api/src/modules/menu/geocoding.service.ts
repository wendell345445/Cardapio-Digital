import { AppError } from '../../shared/middleware/error.middleware'
import { cache } from '../../shared/redis/redis'

// Geocoding = endereço (texto) → { latitude, longitude }.
// Usado no checkout público pra resolver o endereço do cliente e então calcular
// a taxa de entrega via Haversine contra as coordenadas da loja.
//
// Provider padrão: Nominatim (OpenStreetMap). Grátis, sem token. Exige User-Agent
// identificando a aplicação (política OSM). Rate-limit: 1 req/s.
//
// Troque o provider pela env `GEOCODING_PROVIDER`. Se um dia precisar trocar
// pra Google/Mapbox, basta implementar a interface e plugar no switch abaixo.

export interface GeocodeInput {
  cep?: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  country?: string
}

export interface GeocodeResult {
  latitude: number
  longitude: number
  displayName?: string
}

interface GeocodingProvider {
  geocode(input: GeocodeInput): Promise<GeocodeResult>
  reverse(latitude: number, longitude: number): Promise<GeocodeResult>
}

// ─── Nominatim ───────────────────────────────────────────────────────────────

function nominatimBaseUrl(): string {
  return process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org'
}
function nominatimUserAgent(): string {
  return (
    process.env.NOMINATIM_USER_AGENT ||
    'MenuPanda/1.0 (wendellalonso2013@gmail.com)'
  )
}

// Shape subset do JSON do Nominatim /search
interface NominatimHit {
  lat: string
  lon: string
  display_name?: string
}

function buildQuery(input: GeocodeInput): string {
  const parts = [
    input.street && input.number ? `${input.street}, ${input.number}` : input.street,
    input.neighborhood,
    input.city,
    input.state,
    input.cep,
    input.country ?? 'Brasil',
  ].filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
  return parts.join(', ')
}

const nominatim: GeocodingProvider = {
  async geocode(input) {
    const hasUsefulFields =
      Boolean(input.street?.trim()) ||
      Boolean(input.cep?.trim()) ||
      Boolean(input.city?.trim())
    if (!hasUsefulFields) {
      throw new AppError('Endereço insuficiente para geocodificação', 422)
    }

    const query = buildQuery(input)
    if (!query) throw new AppError('Endereço vazio para geocodificação', 422)

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      addressdetails: '0',
    })

    let response: Response
    try {
      response = await fetch(`${nominatimBaseUrl()}/search?${params.toString()}`, {
        headers: { 'User-Agent': nominatimUserAgent(), Accept: 'application/json' },
      })
    } catch {
      throw new AppError('Serviço de geocodificação indisponível', 503)
    }

    if (!response.ok) {
      throw new AppError('Serviço de geocodificação indisponível', 503)
    }

    const hits = (await response.json()) as NominatimHit[]
    if (!Array.isArray(hits) || hits.length === 0) {
      throw new AppError('Endereço não encontrado', 422)
    }

    const lat = Number(hits[0].lat)
    const lng = Number(hits[0].lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new AppError('Endereço não encontrado', 422)
    }

    return { latitude: lat, longitude: lng, displayName: hits[0].display_name }
  },

  async reverse(latitude, longitude) {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: 'json',
      addressdetails: '0',
    })

    let response: Response
    try {
      response = await fetch(`${nominatimBaseUrl()}/reverse?${params.toString()}`, {
        headers: { 'User-Agent': nominatimUserAgent(), Accept: 'application/json' },
      })
    } catch {
      throw new AppError('Serviço de geocodificação indisponível', 503)
    }

    if (!response.ok) {
      throw new AppError('Serviço de geocodificação indisponível', 503)
    }

    // Nominatim /reverse retorna um objeto, não array
    const hit = (await response.json()) as NominatimHit & { error?: string }
    if (!hit || hit.error || !hit.display_name) {
      throw new AppError('Endereço não encontrado para estas coordenadas', 422)
    }

    return { latitude, longitude, displayName: hit.display_name }
  },
}

// ─── Provider selection ──────────────────────────────────────────────────────

function getProvider(): GeocodingProvider {
  const name = (process.env.GEOCODING_PROVIDER || 'nominatim').toLowerCase()
  switch (name) {
    case 'nominatim':
      return nominatim
    default:
      throw new AppError(`Geocoding provider desconhecido: ${name}`, 500)
  }
}

// ─── Public API (cached) ─────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 dias

function cacheKey(input: GeocodeInput): string {
  const normalized = [
    input.cep?.replace(/\D/g, ''),
    input.street?.trim().toLowerCase(),
    input.number?.trim().toLowerCase(),
    input.neighborhood?.trim().toLowerCase(),
    input.city?.trim().toLowerCase(),
    input.state?.trim().toLowerCase(),
    (input.country ?? 'Brasil').trim().toLowerCase(),
  ].join('|')
  return `geocode:${normalized}`
}

export async function geocodeAddress(input: GeocodeInput): Promise<GeocodeResult> {
  const key = cacheKey(input)

  try {
    const cached = await cache.get<GeocodeResult>(key)
    if (cached) return cached
  } catch {
    // Redis indisponível: segue direto pro provider
  }

  const result = await getProvider().geocode(input)

  try {
    await cache.set(key, result, CACHE_TTL_SECONDS)
  } catch {
    // Redis indisponível: não bloqueia o retorno
  }

  return result
}

// Reverse: lat/lng → displayName (ex: "Av. Paulista, 1000 - Bela Vista, São Paulo").
// Arredonda em 5 casas decimais na cache key (≈1m de precisão) — evita fragmentar
// o cache pra coordenadas praticamente idênticas.
function reverseCacheKey(lat: number, lng: number): string {
  return `geocode:reverse:${lat.toFixed(5)}:${lng.toFixed(5)}`
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodeResult> {
  const key = reverseCacheKey(latitude, longitude)

  try {
    const cached = await cache.get<GeocodeResult>(key)
    if (cached) return cached
  } catch {
    // sem cache, segue
  }

  const result = await getProvider().reverse(latitude, longitude)

  try {
    await cache.set(key, result, CACHE_TTL_SECONDS)
  } catch {
    // sem cache, segue
  }

  return result
}
