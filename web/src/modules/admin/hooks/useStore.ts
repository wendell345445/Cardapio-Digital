import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchBusinessHours,
  fetchStore,
  updateBusinessHours,
  updatePaymentSettings,
  updatePix,
  updateStore,
  updateStoreStatus,
  updateWhatsapp,
  type BusinessHour,
  type UpdatePaymentSettingsDto,
  type UpdateStoreDto,
} from '../services/store.service'

// ─── TASK-050/051/052: Hooks de configurações da loja ────────────────────────

export function useStore() {
  return useQuery({
    queryKey: ['store'],
    queryFn: fetchStore,
  })
}

export function useUpdateStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateStoreDto) => updateStore(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store'] }),
  })
}

export function useBusinessHours() {
  return useQuery({
    queryKey: ['store', 'hours'],
    queryFn: fetchBusinessHours,
  })
}

export function useUpdateBusinessHours() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { hours: BusinessHour[] }) => updateBusinessHours(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'hours'] }),
  })
}

export function useUpdateStoreStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { manualOpen: boolean | null }) => updateStoreStatus(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store'] }),
  })
}

export function useUpdateWhatsapp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { phone: string; password: string }) => updateWhatsapp(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store'] }),
  })
}

export function useUpdatePix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { pixKey: string; pixKeyType: string; password: string }) =>
      updatePix(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store'] }),
  })
}

export function useUpdatePaymentSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdatePaymentSettingsDto) => updatePaymentSettings(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store'] }),
  })
}
