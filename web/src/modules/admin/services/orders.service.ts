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
  clientWhatsapp?: string | null
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
  paymentReceivedAt?: string | null
  paymentReceivedBy?: { id: string; name?: string | null; role?: string } | null
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

// ─── PDV: criar pedido pelo admin (telefone/balcão) ─────────────────────────
// Métodos de pagamento aceitos pelo backend (createAdminOrderSchema). Inclui os
// "limpos" (presencial/balcão) + os *_ON_DELIVERY + PENDING (mesa sem método).
export type AdminPaymentMethod =
  | 'PIX'
  | 'CASH'
  | 'CREDIT'
  | 'DEBIT'
  | 'CASH_ON_DELIVERY'
  | 'CREDIT_ON_DELIVERY'
  | 'DEBIT_ON_DELIVERY'
  | 'PIX_ON_DELIVERY'
  | 'PENDING'

export interface CreateAdminOrderItem {
  productId: string
  variationId?: string
  quantity: number
  notes?: string
  addonIds: string[]
}

export interface CreateAdminOrderDto {
  clientName: string
  type: 'DELIVERY' | 'PICKUP' | 'TABLE'
  paymentMethod: AdminPaymentMethod
  notes?: string
  couponCode?: string
  /** Mesa selecionada (só type=TABLE). O backend abre/anexa a sessão. */
  tableId?: string
  deviceName?: string
  deliveryNeighborhoodId?: string
  address?: {
    zipCode?: string
    street: string
    number: string
    complement?: string
    neighborhood?: string
    city?: string
    state?: string
  }
  items: CreateAdminOrderItem[]
}

export interface CreateAdminOrderResult {
  orderId: string
  orderNumber: number
  total: number
  status: string
}

export async function createOrder(dto: CreateAdminOrderDto): Promise<CreateAdminOrderResult> {
  const { data } = await api.post('/admin/orders', dto)
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

// M-012: admin confirma recebimento do pagamento
export async function confirmOrderPayment(id: string): Promise<Order> {
  const { data } = await api.patch(`/admin/orders/${id}/confirm-payment`)
  return data.data
}


// TASK-084/A-050: Buscar recibo formatado para impressão
export async function fetchOrderReceipt(id: string): Promise<string> {
  const { data } = await api.get(`/admin/orders/${id}/receipt`)
  return data.data.receipt
}

// Botão "Imprimir": tenta enfileirar na fila do Menuziprinter. Retorna
// queued=true quando a loja usa a fila (auto_print ON); queued=false quando o
// frontend deve imprimir pelo navegador (window.print).
export async function printOrder(id: string): Promise<{ queued: boolean }> {
  const { data } = await api.post(`/admin/orders/${id}/print`)
  return data.data
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
