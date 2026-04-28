import { useQuery } from '@tanstack/react-query'

import { getSales, getTopProducts, type Period } from '../services/analytics.service'
import { fetchOrders } from '../services/orders.service'

export function useAdminDashboard(period: Period = 'day') {
  const sales = useQuery({
    queryKey: ['analytics', 'sales', period],
    queryFn: () => getSales(period),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  const topProducts = useQuery({
    queryKey: ['analytics', 'top-products', period, 4],
    queryFn: () => getTopProducts(period, 4),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  const salesWeekly = useQuery({
    queryKey: ['analytics', 'sales', 'week'],
    queryFn: () => getSales('week'),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  const recentOrders = useQuery({
    queryKey: ['orders', 'recent'],
    queryFn: () => fetchOrders({ limit: 5 }),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  const liveOrders = useQuery({
    queryKey: ['orders', 'live'],
    queryFn: () => fetchOrders({ status: 'WAITING_PAYMENT_PROOF,WAITING_CONFIRMATION,CONFIRMED,PREPARING,READY,DISPATCHED', limit: 100 }),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  return { sales, topProducts, salesWeekly, recentOrders, liveOrders }
}
