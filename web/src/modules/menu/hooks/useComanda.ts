// ─── A-056: Comanda pública do cliente — Hooks ──────────────────────────────

import { useQuery, useMutation } from '@tanstack/react-query'

import { fetchCustomerComanda, requestCheck } from '../services/comanda.service'

export function useCustomerComanda(tableNumber: number | null) {
  return useQuery({
    queryKey: ['customer-comanda', tableNumber],
    queryFn: () => fetchCustomerComanda(tableNumber!),
    enabled: !!tableNumber,
    staleTime: 30_000,
  })
}

export function useRequestCheck() {
  return useMutation({
    mutationFn: (tableNumber: number) => requestCheck(tableNumber),
  })
}
