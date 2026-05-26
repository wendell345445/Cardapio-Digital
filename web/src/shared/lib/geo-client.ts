import { api } from './api'
import { createPublicApi } from './publicApi'

// Instância pública singleton (mesma estratégia do comanda.service.ts).
const publicApi = createPublicApi()

// Cliente do módulo geo (browser → api → OSM via mTLS).
// O browser NÃO apresenta cert mTLS — quem apresenta é a api Railway. Aqui só
// chamamos os endpoints proxy `/menu/geo/*` (público, tenant-scoped) e
// `/admin/delivery/geo/*` (admin autenticado).

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
  /** CEP brasileiro quando OSM tem mapeado. Pode vir undefined no interior. */
  postcode?: string
}

export interface GeoRoute {
  distanceKm: number
  durationMin: number
}

type Scope = 'public' | 'admin'

function basePath(scope: Scope): string {
  // Público (checkout): /menu/geo (tenant-scoped pelo subdomínio).
  // Admin (PDV, DeliveryPage, etc): /admin/delivery/geo (auth + role).
  return scope === 'public' ? '/menu/geo' : '/admin/delivery/geo'
}

function client(scope: Scope) {
  return scope === 'public' ? publicApi : api
}

export async function autocompleteAddress(
  query: string,
  opts: { lat?: number; lon?: number; limit?: number; scope?: Scope } = {}
): Promise<GeoSuggestion[]> {
  const scope = opts.scope ?? 'public'
  if (query.trim().length < 3) return []
  const params = new URLSearchParams({ q: query })
  if (typeof opts.lat === 'number') params.set('lat', String(opts.lat))
  if (typeof opts.lon === 'number') params.set('lon', String(opts.lon))
  if (typeof opts.limit === 'number') params.set('limit', String(opts.limit))
  const res = await client(scope).get<{ success: boolean; data: GeoSuggestion[] }>(
    `${basePath(scope)}/autocomplete?${params.toString()}`
  )
  return res.data.data
}

export async function reverseAddress(
  lat: number,
  lon: number,
  scope: Scope = 'public'
): Promise<GeoAddress> {
  const res = await client(scope).post<{ success: boolean; data: GeoAddress }>(
    `${basePath(scope)}/reverse`,
    { lat, lon }
  )
  return res.data.data
}

export async function routeBetween(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  scope: Scope = 'public'
): Promise<GeoRoute> {
  const res = await client(scope).post<{ success: boolean; data: GeoRoute }>(
    `${basePath(scope)}/route`,
    { from, to }
  )
  return res.data.data
}
