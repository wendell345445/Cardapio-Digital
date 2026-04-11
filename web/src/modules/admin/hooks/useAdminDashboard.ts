import { useQuery } from '@tanstack/react-query'

import { getSales, getTopProducts } from '../services/analytics.service'
import { fetchOrders } from '../services/orders.service'

export function useAdminDashboard() {
  const sales = useQuery({
    queryKey: ['analytics', 'sales', 'week'],
    queryFn: () => getSales('week'),
    staleTime: 60_000,
  })

  const topProducts = useQuery({
    queryKey: ['analytics', 'top-products', 'week', 4],
    queryFn: () => getTopProducts('week', 4),
    staleTime: 60_000,
  })

  const recentOrders = useQuery({
    queryKey: ['orders', 'recent'],
    queryFn: () => fetchOrders({ limit: 5 }),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  const liveOrders = useQuery({
    queryKey: ['orders', 'live'],
    queryFn: () => fetchOrders({ status: 'PENDING,WAITING_PAYMENT_PROOF,WAITING_CONFIRMATION,CONFIRMED,PREPARING,READY,DISPATCHED', limit: 100 }),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  return { sales, topProducts, recentOrders, liveOrders }
}
