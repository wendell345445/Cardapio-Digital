import { AppError } from '../../../../shared/middleware/error.middleware'
import { geoGet } from '../geo.client'

// Nominatim — geocoding (texto → coordenada) e reverse (coordenada → endereço).
// Self-hosted na nossa VM com import do Brasil completo (osm2pgsql + indexing).
//
// IMPORTANTE: o Nominatim recusa `Accept: application/json` no header (retorna
// 406). A negociação é via `format=json` na query — já tratado em geo.client.ts.

export interface NominatimAddress {
  /** Display name humanizado completo (já vem em pt-BR com accept-language). */
  displayName: string
  latitude: number
  longitude: number
  /** Componentes estruturados — todos opcionais (varia por endereço). */
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  /** CEP brasileiro (postcode no OSM). NULL quando o OSM não tem mapeado pra
   * esse ponto — comum no interior. */
  postcode?: string
}

interface NominatimResult {
  place_id?: number
  lat: string
  lon: string
  display_name: string
  address?: {
    road?: string
    pedestrian?: string
    house_number?: string
    suburb?: string
    neighbourhood?: string
    city_district?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    state?: string
    postcode?: string
    country_code?: string
  }
}

function geocodingUrl(): string {
  const u = process.env.GEO_GEOCODING_URL
  if (!u) throw new AppError('GEO_GEOCODING_URL não configurada', 503)
  return u
}

function parseResult(r: NominatimResult): NominatimAddress {
  const lat = Number(r.lat)
  const lon = Number(r.lon)
  const a = r.address ?? {}
  return {
    displayName: r.display_name,
    latitude: lat,
    longitude: lon,
    street: a.road ?? a.pedestrian,
    number: a.house_number,
    neighborhood: a.suburb ?? a.neighbourhood ?? a.city_district,
    city: a.city ?? a.town ?? a.village ?? a.municipality,
    state: a.state,
    postcode: a.postcode,
  }
}

export interface NominatimSearchInput {
  /** Texto livre — ex: "Avenida Paulista 1578, Sao Paulo". */
  q?: string
  /** Componentes separados (Nominatim combina). */
  street?: string
  number?: string
  city?: string
  state?: string
  country?: string
  signal?: AbortSignal
}

/** Texto livre → coordenada + endereço estruturado. */
export async function search(input: NominatimSearchInput): Promise<NominatimAddress | null> {
  const q = input.q?.trim() || [
    input.street && input.number ? `${input.street} ${input.number}` : input.street,
    input.city,
    input.state,
    input.country ?? 'Brasil',
  ]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .join(', ')
  if (!q) throw new AppError('Endereço vazio', 422)

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    'accept-language': 'pt-BR',
    countrycodes: 'br',
    limit: '1',
  })

  const data = (await geoGet(
    `${geocodingUrl()}/search?${params.toString()}`,
    input.signal
  )) as NominatimResult[] | null

  if (!Array.isArray(data) || data.length === 0) return null
  return parseResult(data[0])
}

/** Coordenada → endereço (suporta o pin arrastável). */
export async function reverse(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<NominatimAddress> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'json',
    addressdetails: '1',
    'accept-language': 'pt-BR',
  })
  const data = (await geoGet(
    `${geocodingUrl()}/reverse?${params.toString()}`,
    signal
  )) as NominatimResult | null

  if (!data || !data.display_name) {
    throw new AppError('Endereço não encontrado para estas coordenadas', 422)
  }
  return parseResult(data)
}
