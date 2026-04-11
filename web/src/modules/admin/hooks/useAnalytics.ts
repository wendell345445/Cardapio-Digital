import { useQuery } from '@tanstack/react-query'

import {
  getClientRanking,
  getPeakHours,
  getSales,
  getTopProducts,
  type ClientRankingParams,
  type Period,
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
