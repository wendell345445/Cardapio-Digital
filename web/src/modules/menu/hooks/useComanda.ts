// ─── Comanda pública do cliente — Hooks ─────────────────────────────────────

import { useQuery, useMutation } from '@tanstack/react-query'

import { fetchCustomerComanda, requestCheck } from '../services/comanda.service'

export function useCustomerComanda(sessionToken: string | null) {
  return useQuery({
    queryKey: ['customer-comanda', sessionToken],
    queryFn: () => fetchCustomerComanda(sessionToken!),
    enabled: !!sessionToken,
    staleTime: 30_000,
  })
}

export function useRequestCheck() {
  return useMutation({
    mutationFn: (sessionToken: string) => requestCheck(sessionToken),
  })
}
