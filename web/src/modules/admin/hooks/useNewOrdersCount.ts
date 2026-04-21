import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchOrders } from '../services/orders.service'

import { useAuthStore } from '@/modules/auth/store/useAuthStore'
import { useSocket } from '@/shared/hooks/useSocket'

const NEW_ORDERS_STATUS = 'PENDING,WAITING_PAYMENT_PROOF,WAITING_CONFIRMATION'
const NEW_ORDERS_QUERY_KEY = ['orders', 'new-count'] as const

// A-009: polling 30s como fallback + listener Socket.io (`order:new` / `order:status`)
// invalida a query imediatamente pra badge atualizar em tempo real.
export function useNewOrdersCount() {
  const storeId = useAuthStore((s) => s.user?.storeId ?? null)
  const socket = useSocket(storeId)
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: NEW_ORDERS_QUERY_KEY,
    queryFn: () => fetchOrders({ status: NEW_ORDERS_STATUS, limit: 100 }),
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (!socket) return

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: NEW_ORDERS_QUERY_KEY })
    }

    socket.on('order:new', invalidate)
    socket.on('order:status', invalidate)

    return () => {
      socket.off('order:new', invalidate)
      socket.off('order:status', invalidate)
    }
  }, [socket, qc])

  return { count: query.data?.orders.length ?? 0, orders: query.data?.orders ?? [] }
}
