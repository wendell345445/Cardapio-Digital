import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getClientRanking,
  getCustomerDetail,
  getCustomerOrders,
  getPeakHours,
  getSales,
  getTopProducts,
  updateCustomer,
  type ClientRankingParams,
  type Period,
  type UpdateCustomerInput,
} from '../services/analytics.service'

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useSales(period: Period) {
  return useQuery({
    queryKey: ['analytics', 'sales', period],
    queryFn: () => getSales(period),
    staleTime: 5 * 60 * 1000,
  })
}

export function useTopProducts(period: Period, limit?: number) {
  return useQuery({
    queryKey: ['analytics', 'top-products', period, limit],
    queryFn: () => getTopProducts(period, limit),
    staleTime: 5 * 60 * 1000,
  })
}

export function usePeakHours() {
  return useQuery({
    queryKey: ['analytics', 'peak-hours'],
    queryFn: () => getPeakHours(),
    staleTime: 10 * 60 * 1000,
  })
}

export function useClientRanking(params: ClientRankingParams) {
  return useQuery({
    queryKey: ['analytics', 'clients-ranking', params],
    queryFn: () => getClientRanking(params),
    staleTime: 1 * 60 * 1000,
  })
}

export function useCustomerDetail(whatsapp: string | null) {
  return useQuery({
    queryKey: ['analytics', 'customer-detail', whatsapp],
    queryFn: () => getCustomerDetail(whatsapp!),
    enabled: !!whatsapp,
    staleTime: 30 * 1000,
  })
}

export function useCustomerOrders(whatsapp: string | null, page = 1, limit = 10) {
  return useQuery({
    queryKey: ['analytics', 'customer-orders', whatsapp, page, limit],
    queryFn: () => getCustomerOrders(whatsapp!, page, limit),
    enabled: !!whatsapp,
    staleTime: 30 * 1000,
  })
}

export function useUpdateCustomer(whatsapp: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateCustomerInput) => updateCustomer(whatsapp, input),
    onSuccess: (data) => {
      qc.setQueryData(['analytics', 'customer-detail', whatsapp], data)
      qc.invalidateQueries({ queryKey: ['analytics', 'clients-ranking'] })
    },
  })
}
