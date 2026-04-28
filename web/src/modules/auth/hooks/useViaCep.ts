import { useCallback, useState } from 'react'

import { api } from '@/shared/lib/api'

// Mantém o nome `useViaCep` por compatibilidade com os callers existentes
// (RegisterStorePage, DeliveryPage, CheckoutDrawer). Por baixo, agora chama
// o backend (`POST /api/v1/cep/lookup`), que tenta Google Geocoding primeiro
// e cai em ViaCEP quando o Google não traz dados utilizáveis. Centraliza no
// backend pra (1) cobrir CEPs únicos de cidade pequena que o ViaCEP devolve
// truncado, (2) proteger a chave da Google Geocoding (não vai pro browser)
// e (3) contabilizar quota.

export interface ViaCepResult {
  street: string
  neighborhood: string
  city: string
  state: string
}

interface CepLookupResponse {
  success: boolean
  data: {
    cep: string
    street: string
    neighborhood: string
    city: string
    state: string
    source: 'google' | 'viacep'
  }
}

/**
 * Consulta CEP via backend (`POST /cep/lookup`). Retorna os campos de endereço.
 * Lança erro caso o CEP seja inválido (8 dígitos) ou o backend retorne erro.
 */
export async function fetchCep(cep: string): Promise<ViaCepResult> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) {
    throw new Error('CEP inválido')
  }

  try {
    const response = await api.post<CepLookupResponse>('/cep/lookup', { cep: digits })
    const data = response.data?.data
    if (!data) throw new Error('CEP não encontrado')
    return {
      street: data.street ?? '',
      neighborhood: data.neighborhood ?? '',
      city: data.city ?? '',
      state: data.state ?? '',
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CEP não encontrado') throw err
    const message =
      (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
        ?.error ??
      (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
        ?.message ??
      'Falha ao consultar CEP'
    throw new Error(message)
  }
}

interface UseViaCepResult {
  lookup: (cep: string) => Promise<ViaCepResult | null>
  isLoading: boolean
  error: string | null
}

/**
 * Hook que expõe `lookup(cep)` com loading e error states.
 * Falha silenciosamente — em caso de erro retorna `null` e os campos ficam editáveis manualmente.
 *
 * `lookup` é memoizado com `useCallback` (deps vazias — só usa setters do useState que são estáveis)
 * para que callers possam incluí-lo em dependency arrays de `useEffect` sem causar loops.
 */
export function useViaCep(): UseViaCepResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = useCallback(async (cep: string): Promise<ViaCepResult | null> => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchCep(cep)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar CEP')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { lookup, isLoading, error }
}
