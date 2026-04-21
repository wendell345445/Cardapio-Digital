import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  assignMotoboy,
  fetchOrder,
  fetchOrderReceipt,
  fetchOrders,
  printReceipt,
  sendWaitingPayment,
  updateOrderStatus,
  type ListOrdersParams,
} from '../services/orders.service'

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useOrders(params?: ListOrdersParams) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => fetchOrders(params),
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id),
    enabled: Boolean(id),
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, cancelReason }: { id: string; status: string; cancelReason?: string }) =>
      updateOrderStatus(id, status, cancelReason),
    onSuccess: (updatedOrder) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order', updatedOrder.id] })
    },
  })
}

export function useAssignMotoboy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motoboyId }: { id: string; motoboyId: string }) =>
      assignMotoboy(id, motoboyId),
    onSuccess: (updatedOrder) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order', updatedOrder.id] })
    },
  })
}

// TASK-084/A-050: Impressão manual do pedido
export function usePrintOrder() {
  return useMutation({
    mutationFn: async (id: string) => {
      const receipt = await fetchOrderReceipt(id)
      printReceipt(receipt)
    },
  })
}

// TASK-124: Botão manual "Aguardando Pix"
export function useSendWaitingPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => sendWaitingPayment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}
