import { api } from '@/shared/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string
  productName: string
  variationName?: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  notes?: string | null
  additionals: Array<{ id: string; name: string; price: number }>
}

export interface OrderAddress {
  zipCode?: string
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state?: string | null
}

export interface Order {
  id: string
  number: number
  status: string
  type: string
  paymentMethod: string
  clientName?: string | null
  clientWhatsapp: string
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  address?: OrderAddress | null
  notes?: string | null
  tableId?: string | null
  motoboyId?: string | null
  motoboy?: { id: string; name?: string | null } | null
  client?: { id: string; name?: string | null; whatsapp: string } | null
  coupon?: { id: string; code: string } | null
  items: OrderItem[]
  createdAt: string
  confirmedAt?: string | null
  preparedAt?: string | null
  dispatchedAt?: string | null
  deliveredAt?: string | null
  cancelledAt?: string | null
  deliveryIssueReason?: string | null
}

export interface ListOrdersParams {
  status?: string
  paymentMethod?: string
  dateFrom?: string
  dateTo?: string
  cursor?: string
  limit?: number
}

export interface ListOrdersResponse {
  orders: Order[]
  nextCursor: string | null
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchOrders(params?: ListOrdersParams): Promise<ListOrdersResponse> {
  const { data } = await api.get('/admin/orders', { params })
  return data.data
}

export async function fetchOrder(id: string): Promise<Order> {
  const { data } = await api.get(`/admin/orders/${id}`)
  return data.data
}

export async function updateOrderStatus(
  id: string,
  status: string,
  cancelReason?: string
): Promise<Order> {
  const { data } = await api.patch(`/admin/orders/${id}/status`, { status, cancelReason })
  return data.data
}

export async function assignMotoboy(id: string, motoboyId: string): Promise<Order> {
  const { data } = await api.patch(`/admin/orders/${id}/motoboy`, { motoboyId })
  return data.data
}

export async function updateOrderAddress(id: string, address: OrderAddress): Promise<Order> {
  const { data } = await api.patch(`/admin/orders/${id}/address`, address)
  return data.data
}

// TASK-084/A-050: Buscar recibo formatado para impressão
export async function fetchOrderReceipt(id: string): Promise<string> {
  const { data } = await api.get(`/admin/orders/${id}/receipt`)
  return data.data.receipt
}

/** Abre janela de impressão com o recibo formatado para impressora térmica */
export function printReceipt(receipt: string, orderNumber?: number) {
  const title = orderNumber ? `Pedido #${orderNumber}` : 'Imprimir Pedido'
  const printWindow = window.open('', '_blank', 'width=500,height=700')
  if (!printWindow) return

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.3;
      margin: 0;
      padding: 8mm;
      white-space: pre;
      overflow-x: auto;
    }
    @media print {
      body { padding: 2mm; }
    }
  </style>
</head>
<body>${receipt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
</html>`)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  printWindow.close()
}
