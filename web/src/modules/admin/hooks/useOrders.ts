import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  assignMotoboy,
  confirmOrderPayment,
  createOrder,
  fetchOrder,
  fetchOrderReceipt,
  fetchOrders,
  printOrder,
  printReceipt,
  updateOrderAddress,
  updateOrderStatus,
  type CreateAdminOrderDto,
  type ListOrdersParams,
  type OrderAddress,
} from '../services/orders.service'

import { toast } from '@/shared/lib/toast'

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

export function useUpdateOrderAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, address }: { id: string; address: OrderAddress }) =>
      updateOrderAddress(id, address),
    onSuccess: (updatedOrder) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order', updatedOrder.id] })
    },
  })
}

// TASK-084/A-050: Impressão manual do pedido.
// Se a loja usa o Menuziprinter (auto_print ON), enfileira na MESMA fila do
// auto-print e a impressora local pega no próximo polling. Senão, cai no fluxo
// antigo de imprimir pelo navegador (window.print).
export function usePrintOrder() {
  return useMutation({
    mutationFn: async ({ id, orderNumber }: { id: string; orderNumber?: number }) => {
      const { queued } = await printOrder(id)
      if (queued) {
        toast.success('Enviado para a impressora')
        return
      }
      const receipt = await fetchOrderReceipt(id)
      printReceipt(receipt, orderNumber)
    },
  })
}

// M-012: admin confirma recebimento do pagamento
export function useConfirmOrderPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => confirmOrderPayment(id),
    onSuccess: (updatedOrder) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order', updatedOrder.id] })
    },
  })
}

// PDV: cria pedido pelo admin. Invalida orders (kanban) e tables (mesa pode ter
// ficado ocupada) ao concluir.
export function useCreateAdminOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateAdminOrderDto) => createOrder(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['tables'] })
    },
  })
}
