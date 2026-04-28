import { AppError } from '../../shared/middleware/error.middleware'
import { cache } from '../../shared/redis/redis'

import { incrementGeocodingUsage } from './geocoding-usage.service'

// Geocoding = endereço (texto) → { latitude, longitude }.
// Usado no checkout público pra resolver o endereço do cliente e então calcular
// a taxa de entrega via Haversine contra as coordenadas da loja.
//
// Provider: Google Geocoding API. Exige `GOOGLE_GEOCODING_API_KEY` no backend.
// Cobertura BR muito superior à OSM/Nominatim (especialmente CEPs únicos de
// cidade pequena, loteamentos novos, condomínios). Resposta cacheada no Redis
// por 7 dias com chave do endereço normalizado.
//
// Quota: o contador de uso é incrementado quando a Google de fato cobra a
// requisição (status `OK` ou `ZERO_RESULTS`). Cache hit, erro de rede,
// `REQUEST_DENIED` ou `INVALID_REQUEST` não contam — espelham o que o Google
// fatura.

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

interface GoogleGeometry {
  location: { lat: number; lng: number }
}
interface GoogleResult {
  formatted_address?: string
  geometry: GoogleGeometry
}
interface GoogleResponse {
  status: string
  results: GoogleResult[]
  error_message?: string
}

// Google cobra quando retorna OK ou ZERO_RESULTS — espelhamos isso no contador.
const BILLABLE_STATUSES = new Set(['OK', 'ZERO_RESULTS'])

function googleApiKey(): string {
  const key = process.env.GOOGLE_GEOCODING_API_KEY
  if (!key || !key.trim()) {
    throw new AppError(
      'Geocoding indisponível: GOOGLE_GEOCODING_API_KEY não configurada',
      503
    )
  }
  return key
}

function googleBaseUrl(): string {
  return process.env.GOOGLE_GEOCODING_BASE_URL || 'https://maps.googleapis.com/maps/api/geocode/json'
}

function buildAddressQuery(input: GeocodeInput): string {
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

async function callGoogle(params: URLSearchParams): Promise<GoogleResponse> {
  // Toda chamada à Google passa por aqui — única porta pra o contador de uso
  // ser incrementado de forma consistente.
  let response: Response
  try {
    response = await fetch(`${googleBaseUrl()}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new AppError('Serviço de geocodificação indisponível', 503)
  }

  if (!response.ok) {
    throw new AppError('Serviço de geocodificação indisponível', 503)
  }

  const body = (await response.json()) as GoogleResponse

  if (BILLABLE_STATUSES.has(body.status)) {
    // Best-effort: erro no Redis não pode derrubar o geocoding em si
    incrementGeocodingUsage().catch(() => undefined)
  }

  return body
}

async function googleGeocode(input: GeocodeInput): Promise<GeocodeResult> {
  const hasUsefulFields =
    Boolean(input.street?.trim()) ||
    Boolean(input.cep?.trim()) ||
    Boolean(input.city?.trim())
  if (!hasUsefulFields) {
    throw new AppError('Endereço insuficiente para geocodificação', 422)
  }

  const query = buildAddressQuery(input)
  if (!query) throw new AppError('Endereço vazio para geocodificação', 422)

  const params = new URLSearchParams({
    address: query,
    key: googleApiKey(),
    region: 'br',
    language: 'pt-BR',
  })

  const body = await callGoogle(params)

  if (body.status === 'ZERO_RESULTS') {
    throw new AppError('Endereço não encontrado', 422)
  }

  if (body.status !== 'OK' || body.results.length === 0) {
    throw new AppError('Serviço de geocodificação indisponível', 503)
  }

  const hit = body.results[0]
  const lat = hit.geometry?.location?.lat
  const lng = hit.geometry?.location?.lng
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new AppError('Endereço não encontrado', 422)
  }

  return { latitude: lat, longitude: lng, displayName: hit.formatted_address }
}

async function googleReverse(latitude: number, longitude: number): Promise<GeocodeResult> {
  const params = new URLSearchParams({
    latlng: `${latitude},${longitude}`,
    key: googleApiKey(),
    language: 'pt-BR',
  })

  const body = await callGoogle(params)

  if (body.status === 'ZERO_RESULTS') {
    throw new AppError('Endereço não encontrado para estas coordenadas', 422)
  }

  if (body.status !== 'OK' || body.results.length === 0) {
    throw new AppError('Serviço de geocodificação indisponível', 503)
  }

  const hit = body.results[0]
  if (!hit.formatted_address) {
    throw new AppError('Endereço não encontrado para estas coordenadas', 422)
  }

  return { latitude, longitude, displayName: hit.formatted_address }
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

  const result = await googleGeocode(input)

  try {
    await cache.set(key, result, CACHE_TTL_SECONDS)
  } catch {
    // Redis indisponível: não bloqueia o retorno
  }

  return result
}

// "Sementeia" o cache de geocode com coords manuais (cliente colou lat/lng
// do Google Maps porque Google Geocoding não achou o endereço). Próximo
// pedido com mesmo endereço normalizado sai do cache sem custo de cota.
// `displayName` fica vazio porque não temos um endereço formatado garantido.
export async function primeGeocodeCacheFromManual(
  input: GeocodeInput,
  coords: { latitude: number; longitude: number }
): Promise<void> {
  try {
    await cache.set(
      cacheKey(input),
      { latitude: coords.latitude, longitude: coords.longitude } satisfies GeocodeResult,
      CACHE_TTL_SECONDS
    )
  } catch {
    // Redis off: não bloqueia
  }
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

  const result = await googleReverse(latitude, longitude)

  try {
    await cache.set(key, result, CACHE_TTL_SECONDS)
  } catch {
    // sem cache, segue
  }

  return result
}
