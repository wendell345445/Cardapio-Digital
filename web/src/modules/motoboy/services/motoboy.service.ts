import { api } from '@/shared/lib/api'

// ─── TASK-083: Serviço Motoboy (Frontend) ────────────────────────────────────
// ─── TASK-124: slug removido da URL — rota agora é /motoboy/orders ────────────

export interface MotoboyOrder {
  id: string
  number: number
  status: string
  clientName?: string | null
  clientWhatsapp?: string | null
  address?: {
    street: string
    number: string
    complement?: string
    neighborhood: string
    city: string
  } | null
  items: Array<{
    productName: string
    variationName?: string | null
    quantity: number
    notes?: string | null
    additionals: Array<{ name: string; price: number }>
  }>
  total: number
  paymentMethod: string
  dispatchedAt?: string | null
  createdAt: string
}

export async function fetchMotoboyOrders(
  tab: 'active' | 'history'
): Promise<MotoboyOrder[]> {
  const { data } = await api.get('/motoboy/orders', { params: { tab } })
  return data.data as MotoboyOrder[]
}

export async function markDelivered(orderId: string): Promise<MotoboyOrder> {
  const { data } = await api.patch(`/motoboy/orders/${orderId}/deliver`)
  return data.data as MotoboyOrder
}

export async function reportDeliveryProblem(
  orderId: string,
  reason: string
): Promise<MotoboyOrder> {
  const { data } = await api.patch(`/motoboy/orders/${orderId}/report-problem`, { reason })
  return data.data as MotoboyOrder
}
