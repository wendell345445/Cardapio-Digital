import { AppError } from '../../shared/middleware/error.middleware'
import { cache } from '../../shared/redis/redis'

import { incrementGeocodingUsage } from './geocoding-usage.service'

// CEP → endereço. Resolve via Google Geocoding (BR component filter) e cai no
// ViaCEP se o Google não trouxer um resultado utilizável (ZERO_RESULTS ou
// resposta sem componentes de logradouro/cidade).
//
// Resultado é cacheado por 7 dias por CEP normalizado (8 dígitos).

export interface CepLookupResult {
  cep: string // 8 dígitos sem máscara
  street: string
  neighborhood: string
  city: string
  state: string
  source: 'google' | 'viacep'
}

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7
const BILLABLE_STATUSES = new Set(['OK', 'ZERO_RESULTS'])

interface GoogleAddressComponent {
  long_name: string
  short_name: string
  types: string[]
}
interface GoogleResult {
  address_components?: GoogleAddressComponent[]
}
interface GoogleResponse {
  status: string
  results: GoogleResult[]
}

interface ViaCepResponse {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

function normalize(cep: string): string {
  return cep.replace(/\D/g, '')
}

function cepCacheKey(cep: string): string {
  return `cep:${cep}`
}

function googleApiKey(): string | null {
  const key = process.env.GOOGLE_GEOCODING_API_KEY
  return key && key.trim() ? key : null
}

function googleBaseUrl(): string {
  return process.env.GOOGLE_GEOCODING_BASE_URL || 'https://maps.googleapis.com/maps/api/geocode/json'
}

function viaCepBaseUrl(): string {
  return process.env.VIACEP_BASE_URL || 'https://viacep.com.br'
}

function pickComponent(
  components: GoogleAddressComponent[] | undefined,
  type: string
): string {
  if (!components) return ''
  const match = components.find((c) => c.types.includes(type))
  return match?.long_name?.trim() ?? ''
}

async function tryGoogle(cep: string): Promise<CepLookupResult | null> {
  const key = googleApiKey()
  if (!key) return null

  const params = new URLSearchParams({
    components: `country:BR|postal_code:${cep}`,
    key,
    language: 'pt-BR',
  })

  let response: Response
  try {
    response = await fetch(`${googleBaseUrl()}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    return null
  }

  if (!response.ok) return null

  const body = (await response.json()) as GoogleResponse

  if (BILLABLE_STATUSES.has(body.status)) {
    incrementGeocodingUsage().catch(() => undefined)
  }

  if (body.status !== 'OK' || !body.results.length) return null

  const components = body.results[0].address_components
  const city =
    pickComponent(components, 'administrative_area_level_2') ||
    pickComponent(components, 'locality') ||
    pickComponent(components, 'sublocality')
  const state =
    components?.find((c) => c.types.includes('administrative_area_level_1'))?.short_name?.trim() ?? ''
  const neighborhood =
    pickComponent(components, 'sublocality_level_1') ||
    pickComponent(components, 'sublocality') ||
    pickComponent(components, 'political')
  const street = pickComponent(components, 'route')

  // Resultado útil exige pelo menos cidade + UF. Sem isso, devolvemos null pra
  // o fallback ViaCEP cobrir.
  if (!city || !state) return null

  return { cep, street, neighborhood, city, state, source: 'google' }
}

async function tryViaCep(cep: string): Promise<CepLookupResult | null> {
  let response: Response
  try {
    response = await fetch(`${viaCepBaseUrl()}/ws/${cep}/json/`)
  } catch {
    return null
  }

  if (!response.ok) return null

  const data = (await response.json()) as ViaCepResponse
  if (data.erro) return null

  const city = data.localidade?.trim() ?? ''
  const state = data.uf?.trim() ?? ''
  if (!city || !state) return null

  return {
    cep,
    street: data.logradouro?.trim() ?? '',
    neighborhood: data.bairro?.trim() ?? '',
    city,
    state,
    source: 'viacep',
  }
}

export async function lookupCep(rawCep: string): Promise<CepLookupResult> {
  const cep = normalize(rawCep)
  if (cep.length !== 8) {
    throw new AppError('CEP inválido', 422)
  }

  const key = cepCacheKey(cep)

  try {
    const cached = await cache.get<CepLookupResult>(key)
    if (cached) return cached
  } catch {
    // Redis off: segue
  }

  const fromGoogle = await tryGoogle(cep)
  const result = fromGoogle ?? (await tryViaCep(cep))

  if (!result) {
    throw new AppError('CEP não encontrado', 422)
  }

  try {
    await cache.set(key, result, CACHE_TTL_SECONDS)
  } catch {
    // Redis off: não bloqueia retorno
  }

  return result
}
