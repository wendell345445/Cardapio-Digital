import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchOrders } from '../services/orders.service'

import { useAuthStore } from '@/modules/auth/store/useAuthStore'
import { useSocket } from '@/shared/hooks/useSocket'

// Badge da sidebar admin: pedidos que ainda estão na coluna "Novos" do Kanban
// (aguardando comprovante de pagamento ou confirmação manual). PENDING foi descontinuado.
const NEW_ORDERS_STATUS = 'WAITING_PAYMENT_PROOF,WAITING_CONFIRMATION'
const NEW_ORDERS_QUERY_KEY = ['orders', 'new-count'] as const

// O board de Pedidos abre sempre em HOJE. O badge conta só os "Novos" de HOJE pra
// bater com o que o operador vê no board (senão pedidos pendentes de dias antigos —
// tipicamente testes que nunca foram confirmados — inflam o badge e não aparecem
// no board, gerando "badge=N / board vazio"). Janela = dia local [00:00, 23:59:59].
function todayRangeISO(): { from: string; to: string } {
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date()
  to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

// A-009: polling 30s como fallback + listener Socket.io (`order:new` / `order:status`)
// invalida a query imediatamente pra badge atualizar em tempo real.
export function useNewOrdersCount() {
  const storeId = useAuthStore((s) => s.user?.storeId ?? null)
  const socket = useSocket(storeId)
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: NEW_ORDERS_QUERY_KEY,
    queryFn: () => {
      const { from, to } = todayRangeISO()
      return fetchOrders({ status: NEW_ORDERS_STATUS, limit: 100, dateFrom: from, dateTo: to })
    },
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
