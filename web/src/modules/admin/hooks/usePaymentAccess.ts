import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addPaymentAccess,
  addPaymentAccessByWhatsapp,
  fetchStoreClients,
  removePaymentAccess,
  type AddPaymentAccessByWhatsappDto,
  type AddPaymentAccessDto,
} from '../services/payment-access.service'

// ─── TASK-054: Hooks de blacklist/whitelist ───────────────────────────────────

export function useStoreClients() {
  return useQuery({
    queryKey: ['store', 'clients'],
    queryFn: fetchStoreClients,
  })
}

export function useAddPaymentAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: AddPaymentAccessDto) => addPaymentAccess(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'clients'] }),
  })
}

export function useAddPaymentAccessByWhatsapp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: AddPaymentAccessByWhatsappDto) => addPaymentAccessByWhatsapp(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'clients'] }),
  })
}

export function useRemovePaymentAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (clientId: string) => removePaymentAccess(clientId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'clients'] }),
  })
}
