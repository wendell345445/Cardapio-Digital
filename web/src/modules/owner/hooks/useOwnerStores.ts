import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  cancelStore,
  createStore,
  endTrialNow,
  fetchAuditLogs,
  fetchStore,
  fetchStores,
  updateStore,
  updateStorePlan,
  type CreateStoreDto,
  type StoreStatus,
  type StorePlan,
} from '../services/owner.service'

export function useStores(status?: StoreStatus) {
  return useQuery({
    queryKey: ['owner', 'stores', status],
    queryFn: () => fetchStores(status),
  })
}

export function useStore(id: string) {
  return useQuery({
    queryKey: ['owner', 'stores', id],
    queryFn: () => fetchStore(id),
    enabled: !!id,
  })
}

export function useCreateStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateStoreDto) => createStore(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner', 'stores'] }),
  })
}

export function useUpdateStore(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { name?: string; description?: string; status?: StoreStatus }) =>
      updateStore(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner', 'stores', id] })
      qc.invalidateQueries({ queryKey: ['owner', 'stores'] })
    },
  })
}

export function useCancelStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelStore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner', 'stores'] }),
  })
}

export function useUpdateStorePlan(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (plan: StorePlan) => updateStorePlan(id, plan),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner', 'stores', id] })
      qc.invalidateQueries({ queryKey: ['owner', 'stores'] })
    },
  })
}

// Dev tool: encerra trial agora. Invalida o cache da loja para refletir o
// novo status (SUSPENDED) na UI assim que o sweep terminar (~1-2s pelo Bull).
export function useEndTrialNow(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => endTrialNow(id),
    onSuccess: () => {
      // Pequeno delay pra dar tempo do sweep one-shot processar antes do refetch
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['owner', 'stores', id] })
        qc.invalidateQueries({ queryKey: ['owner', 'stores'] })
      }, 1500)
    },
  })
}

export function useAuditLogs(
  storeId: string,
  params: { page?: number; limit?: number; action?: string; from?: string; to?: string }
) {
  return useQuery({
    queryKey: ['owner', 'stores', storeId, 'audit-logs', params],
    queryFn: () => fetchAuditLogs(storeId, params),
    enabled: !!storeId,
  })
}
