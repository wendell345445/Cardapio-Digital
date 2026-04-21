import { getTemplate } from '../admin/whatsapp-messages.service'

import { sendMessage } from './whatsapp.service'

// ─── TASK-071: WhatsApp Mensagens de Status ──────────────────────────────────
// ─── TASK-097: Templates customizados por loja ───────────────────────────────

interface OrderData {
  id: string
  number: number
  clientWhatsapp: string
  clientName?: string | null
  type: string
  status: string
  paymentMethod: string
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  address?: Record<string, string> | null
  items: Array<{
    productName: string
    variationName?: string | null
    quantity: number
    totalPrice: number
    additionals?: Array<{ name: string; price: number }>
  }>
  store: {
    id: string
    name: string
    slug: string
    pixKey?: string | null
    pixKeyType?: string | null
  }
}

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatAddress(address: Record<string, string>): string {
  const parts = [address.street, address.number]
  if (address.complement) parts.push(address.complement)
  parts.push(address.neighborhood, address.city)
  return parts.join(', ')
}

function formatItems(items: OrderData['items']): string {
  return items.map(item => {
    let line = `• ${item.quantity}x ${item.productName}`
    if (item.variationName) line += ` (${item.variationName})`
    line += ` — ${formatMoney(item.totalPrice)}`
    if (item.additionals?.length) {
      line += `\n  + ${item.additionals.map(a => a.name).join(', ')}`
    }
    return line
  }).join('\n')
}

export async function sendOrderCreatedMessage(order: OrderData): Promise<void> {
  const store = order.store

  const itemsStr = formatItems(order.items)
  const totalStr = formatMoney(order.total)

  const templateText = await getTemplate(store.id, 'ORDER_CREATED')
  const message = templateText
    .replace(/\{\{numero\}\}/g, String(order.number))
    .replace(/\{\{loja\}\}/g, store.name)
    .replace(/\{\{itens\}\}/g, itemsStr)
    .replace(/\{\{total\}\}/g, totalStr)
    .replace(/\{\{status\}\}/g, order.status)
    .replace(/\{\{motivo\}\}/g, '')
    .replace(/\{\{horario\}\}/g, '')

  await sendMessage(store.id, order.clientWhatsapp, message)
}

export async function sendStatusUpdateMessage(
  storeId: string,
  phone: string,
  orderNumber: number,
  status: string,
  storeName: string,
  /** Pass order type so READY maps to READY_FOR_PICKUP for pickup orders */
  orderType?: string,
  /** Extra data to fill template variables {{total}}, {{itens}}, {{motivo}} */
  extra?: {
    total?: number
    items?: Array<{ quantity: number; productName: string }>
    /** C-040: motivo do cancelamento — preenche {{motivo}} no template CANCELLED */
    cancelReason?: string
  }
): Promise<void> {
  // Map DB status → WhatsApp event type
  // READY dispatches READY_FOR_PICKUP for pickup orders; delivery uses MOTOBOY_ASSIGNED separately
  let eventType: string | undefined
  if (status === 'READY') {
    eventType = orderType === 'PICKUP' ? 'READY_FOR_PICKUP' : undefined
  } else {
    const eventMap: Record<string, string> = {
      CONFIRMED: 'CONFIRMED',
      PREPARING: 'PREPARING',
      DISPATCHED: 'DISPATCHED',
      DELIVERED: 'DELIVERED',
      CANCELLED: 'CANCELLED',
      WAITING_PAYMENT: 'WAITING_PAYMENT',
    }
    eventType = eventMap[status]
  }

  if (!eventType) return

  const itemsStr = extra?.items?.map(i => `${i.quantity}x ${i.productName}`).join(', ') ?? ''
  const totalStr = extra?.total != null ? formatMoney(extra.total) : ''
  const motivoStr = extra?.cancelReason ? `Motivo: _${extra.cancelReason}_\n` : ''

  const templateText = await getTemplate(storeId, eventType as any)
  const text = templateText
    .replace(/\{\{numero\}\}/g, String(orderNumber))
    .replace(/\{\{loja\}\}/g, storeName)
    .replace(/\{\{status\}\}/g, status)
    .replace(/\{\{total\}\}/g, totalStr)
    .replace(/\{\{itens\}\}/g, itemsStr)
    .replace(/\{\{motivo\}\}/g, motivoStr)
    .replace(/\{\{horario\}\}/g, '')

  await sendMessage(storeId, phone, text)
}

export async function sendWaitingPaymentMessage(
  storeId: string,
  phone: string,
  orderNumber: number,
  storeName: string,
  total: number
): Promise<void> {
  const templateText = await getTemplate(storeId, 'WAITING_PAYMENT')
  const text = templateText
    .replace(/\{\{numero\}\}/g, String(orderNumber))
    .replace(/\{\{loja\}\}/g, storeName)
    .replace(/\{\{total\}\}/g, formatMoney(total))
    .replace(/\{\{status\}\}/g, 'Aguardando pagamento')
    .replace(/\{\{itens\}\}/g, '')
    .replace(/\{\{motivo\}\}/g, '')
    .replace(/\{\{horario\}\}/g, '')

  await sendMessage(storeId, phone, text)
}

export async function sendMotoboyAssignedMessage(
  storeId: string,
  motoboyPhone: string,
  order: {
    number: number
    clientName?: string | null
    clientWhatsapp: string
    address?: Record<string, string> | null
    items: OrderData['items']
    total: number
    paymentMethod: string
    store: { slug: string }
  }
): Promise<void> {
  const addressStr = order.address ? formatAddress(order.address as Record<string, string>) : 'Retirada na loja'
  const mapsUrl = order.address
    ? `https://maps.google.com/?q=${encodeURIComponent(formatAddress(order.address as Record<string, string>))}`
    : ''
  const wazeUrl = order.address
    ? `https://waze.com/ul?q=${encodeURIComponent(formatAddress(order.address as Record<string, string>))}`
    : ''

  const enderecoStr = [
    addressStr,
    mapsUrl ? `🗺️ Maps: ${mapsUrl}` : '',
    wazeUrl ? `🧭 Waze: ${wazeUrl}` : '',
  ].filter(Boolean).join('\n')

  const clienteStr = `${order.clientName ?? 'N/A'} | ${order.clientWhatsapp}`
  const itemsStr = formatItems(order.items)
  const paymentLabel = order.paymentMethod === 'PIX' ? 'Pix — já pago' : 'Cobrar na entrega'
  const totalStr = `${formatMoney(order.total)} (${paymentLabel})`

  const templateText = await getTemplate(storeId, 'MOTOBOY_ASSIGNED')
  const message = templateText
    .replace(/\{\{numero\}\}/g, String(order.number))
    .replace(/\{\{cliente\}\}/g, clienteStr)
    .replace(/\{\{endereco\}\}/g, enderecoStr)
    .replace(/\{\{itens\}\}/g, itemsStr)
    .replace(/\{\{total\}\}/g, totalStr)
    .replace(/\{\{loja\}\}/g, '')
    .replace(/\{\{status\}\}/g, '')
    .replace(/\{\{motivo\}\}/g, '')
    .replace(/\{\{horario\}\}/g, '')

  await sendMessage(storeId, motoboyPhone, message)
}
