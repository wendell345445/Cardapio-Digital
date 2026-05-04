// Lookup de CEP pro cardápio público — usa publicApi (sem autenticação).
// Endpoint `/cep/lookup` é público (montado em router.ts fora de /admin
// e /owner) e tenta Google Geocoding primeiro, caindo em ViaCEP se Google
// não trouxer resultado utilizável.

import { createPublicApi } from '@/shared/lib/publicApi'

const cepApi = createPublicApi()

export interface CepLookupResult {
  cep: string
  street: string
  neighborhood: string
  city: string
  state: string
  source: 'google' | 'viacep'
  /** Coordenadas vêm só quando `source === 'google'`. ViaCEP não tem lat/lng. */
  latitude?: number
  longitude?: number
}

interface CepLookupResponse {
  success: boolean
  data: CepLookupResult
}

export async function lookupCepPublic(cep: string): Promise<CepLookupResult> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) {
    throw new Error('CEP inválido')
  }

  const response = await cepApi.post<CepLookupResponse>('/cep/lookup', { cep: digits })
  const data = response.data?.data
  if (!data) throw new Error('CEP não encontrado')
  return data
}
