import { AppError } from '../../../../shared/middleware/error.middleware'
import { geoGet } from '../geo.client'

// Photon (Komoot) — autocomplete typeahead pra busca de endereço estilo iFood.
// Roda na nossa VM (REGION=south-america, índice OpenSearch). API:
// https://github.com/komoot/photon
//
// IMPORTANTE: o Photon NÃO aceita `lang=pt` — só `default, de, en, fr`. Passar
// `lang=pt` retorna { lang: [...not supported...] } e a query inteira falha.
// Usamos `lang=default` sempre (suporta acentos PT-BR no índice).

export interface PhotonSuggestion {
  name: string
  street?: string
  housenumber?: string
  city?: string
  county?: string
  district?: string
  state?: string
  postcode?: string
  latitude: number
  longitude: number
  /** "street" | "house" | "city" | "locality" | etc — tipo do feature OSM. */
  type: string
}

interface PhotonFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    city?: string
    county?: string
    district?: string
    state?: string
    postcode?: string
    country?: string
    countrycode?: string
    type?: string
    osm_type?: string
    osm_id?: number
  }
}

interface PhotonResponse {
  type: 'FeatureCollection'
  features: PhotonFeature[]
}

function baseUrl(): string {
  const u = process.env.GEO_AUTOCOMPLETE_URL
  if (!u) throw new AppError('GEO_AUTOCOMPLETE_URL não configurada', 503)
  return u
}

export interface PhotonAutocompleteOptions {
  /** Bias geográfico (ex: coords da loja) — melhora ordem dos resultados. */
  lat?: number
  lon?: number
  /** Default 5. Máximo prático ~10 (latência cresce). */
  limit?: number
  signal?: AbortSignal
}

/**
 * Autocomplete de endereço. Filtra resultados pra Brasil (countrycode=BR);
 * outros países entram raramente quando a query é ambígua (ex: "Lisboa").
 */
export async function autocomplete(
  query: string,
  opts: PhotonAutocompleteOptions = {}
): Promise<PhotonSuggestion[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const params = new URLSearchParams({ q, lang: 'default' })
  params.set('limit', String(opts.limit ?? 5))
  if (typeof opts.lat === 'number' && typeof opts.lon === 'number') {
    params.set('lat', String(opts.lat))
    params.set('lon', String(opts.lon))
  }

  const data = (await geoGet(`${baseUrl()}/api?${params.toString()}`, opts.signal)) as PhotonResponse
  if (!data || !Array.isArray(data.features)) return []

  return data.features
    .filter((f) => f.properties.countrycode === 'BR')
    .map((f) => {
      const [lon, lat] = f.geometry.coordinates
      return {
        name: f.properties.name || f.properties.street || '?',
        street: f.properties.street,
        housenumber: f.properties.housenumber,
        city: f.properties.city ?? f.properties.county,
        county: f.properties.county,
        district: f.properties.district,
        state: f.properties.state,
        postcode: f.properties.postcode,
        latitude: lat,
        longitude: lon,
        type: f.properties.type ?? f.properties.osm_type ?? 'unknown',
      }
    })
}
