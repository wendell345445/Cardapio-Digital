import * as photon from './providers/photon.provider'
import * as nominatim from './providers/nominatim.provider'
import * as osrm from './providers/osrm.provider'
import {
  autocompleteKey,
  geocodeKey,
  getCached,
  reverseKey,
  routeKey,
  setCached,
} from './geo.cache'

// Orquestração do módulo geo. Feature flag GEO_USE_OSM controla quem o
// geocoding.service.ts usa (OSM ou Google). Aqui dentro, OSM é canon — quem
// quiser fallback pra Google chama o serviço antigo via wrapper.

export function isOsmEnabled(): boolean {
  return process.env.GEO_USE_OSM === 'true'
}

export function isOsrmRoutingEnabled(): boolean {
  return process.env.GEO_USE_OSRM_ROUTING === 'true'
}

// ─── Tipos públicos (estáveis pra api) ───────────────────────────────────────

export interface GeoSuggestion {
  label: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  postcode?: string
  latitude: number
  longitude: number
}

export interface GeoAddress {
  displayName: string
  latitude: number
  longitude: number
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  /** CEP brasileiro quando OSM tem mapeado pro ponto. Pode ser undefined no interior. */
  postcode?: string
}

export interface GeoRoute {
  distanceKm: number
  durationMin: number
}

// ─── Autocomplete ────────────────────────────────────────────────────────────

export async function autocomplete(
  query: string,
  opts: { lat?: number; lon?: number; limit?: number; signal?: AbortSignal } = {}
): Promise<GeoSuggestion[]> {
  if (!query || query.trim().length < 3) return []
  const key = autocompleteKey(query, opts.lat, opts.lon)
  const cached = await getCached<GeoSuggestion[]>(key)
  if (cached) return cached

  const raw = await photon.autocomplete(query, opts)
  const out: GeoSuggestion[] = raw.map((r) => ({
    label: [r.name, r.city, r.state].filter(Boolean).join(', '),
    street: r.street ?? r.name,
    number: r.housenumber,
    neighborhood: r.district,
    city: r.city ?? r.county,
    state: r.state,
    postcode: r.postcode,
    latitude: r.latitude,
    longitude: r.longitude,
  }))
  await setCached(key, out)
  return out
}

// ─── Geocode (texto → coord) ─────────────────────────────────────────────────

export async function geocode(input: {
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  q?: string
  signal?: AbortSignal
}): Promise<GeoAddress | null> {
  const key = geocodeKey(input)
  const cached = await getCached<GeoAddress>(key)
  if (cached) return cached

  const result = await nominatim.search(input)
  if (!result) return null

  const out: GeoAddress = {
    displayName: result.displayName,
    latitude: result.latitude,
    longitude: result.longitude,
    street: result.street,
    number: result.number,
    neighborhood: result.neighborhood,
    city: result.city,
    state: result.state,
    postcode: result.postcode,
  }
  await setCached(key, out)
  return out
}

// ─── Reverse (coord → endereço; sustenta o pin arrastável) ───────────────────

export async function reverse(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<GeoAddress> {
  const key = reverseKey(latitude, longitude)
  const cached = await getCached<GeoAddress>(key)
  if (cached) return cached

  const result = await nominatim.reverse(latitude, longitude, signal)
  const out: GeoAddress = {
    displayName: result.displayName,
    latitude: result.latitude,
    longitude: result.longitude,
    street: result.street,
    number: result.number,
    neighborhood: result.neighborhood,
    city: result.city,
    state: result.state,
    postcode: result.postcode,
  }
  await setCached(key, out)
  return out
}

// ─── Rota real (OSRM) ────────────────────────────────────────────────────────

export async function route(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  signal?: AbortSignal
): Promise<GeoRoute> {
  const key = routeKey(from, to)
  // Rotas mudam pouco — TTL 30d (vs 7d padrão).
  const cached = await getCached<GeoRoute>(key)
  if (cached) return cached

  const result = await osrm.route({ from, to, signal })
  await setCached(key, result, 60 * 60 * 24 * 30)
  return result
}
