import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getClientRanking,
  getCustomerDetail,
  getCustomerOrders,
  getPaymentBreakdown,
  getPeakHours,
  getSales,
  getTopProducts,
  updateCustomer,
  type ClientRankingParams,
  type DateRange,
  type Period,
  type UpdateCustomerInput,
} from '../services/analytics.service'

// ─── Queries ──────────────────────────────────────────────────────────────────

function rangeReady(period: Period, range?: DateRange): boolean {
  if (period !== 'range') return true
  return !!(range && range.from && range.to)
}

export function useSales(period: Period, range?: DateRange) {
  return useQuery({
    queryKey: ['analytics', 'sales', period, range?.from, range?.to],
    queryFn: () => getSales(period, range),
    staleTime: 5 * 60 * 1000,
    enabled: rangeReady(period, range),
  })
}

export function useTopProducts(period: Period, limit?: number, range?: DateRange) {
  return useQuery({
    queryKey: ['analytics', 'top-products', period, limit, range?.from, range?.to],
    queryFn: () => getTopProducts(period, limit, range),
    staleTime: 5 * 60 * 1000,
    enabled: rangeReady(period, range),
  })
}

export function usePeakHours(period: Period = 'month', range?: DateRange) {
  return useQuery({
    queryKey: ['analytics', 'peak-hours', period, range?.from, range?.to],
    queryFn: () => getPeakHours(period, range),
    staleTime: 10 * 60 * 1000,
    enabled: rangeReady(period, range),
  })
}

export function usePaymentBreakdown(period: Period, range?: DateRange) {
  return useQuery({
    queryKey: ['analytics', 'payment-breakdown', period, range?.from, range?.to],
    queryFn: () => getPaymentBreakdown(period, range),
    staleTime: 5 * 60 * 1000,
    enabled: rangeReady(period, range),
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
