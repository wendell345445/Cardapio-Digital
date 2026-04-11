import { useCallback, useState } from 'react'

export interface ViaCepResult {
  street: string
  neighborhood: string
  city: string
  state: string
}

interface ViaCepResponse {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

/**
 * Consulta a API ViaCEP (https://viacep.com.br/ws/{cep}/json) e retorna os campos de endereço.
 * Lança erro caso o CEP seja inválido ou a API retorne `erro: true`.
 */
export async function fetchCep(cep: string): Promise<ViaCepResult> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) {
    throw new Error('CEP inválido')
  }

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
  if (!response.ok) {
    throw new Error('Falha ao consultar ViaCEP')
  }

  const data = (await response.json()) as ViaCepResponse
  if (data.erro) {
    throw new Error('CEP não encontrado')
  }

  return {
    street: data.logradouro ?? '',
    neighborhood: data.bairro ?? '',
    city: data.localidade ?? '',
    state: data.uf ?? '',
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
