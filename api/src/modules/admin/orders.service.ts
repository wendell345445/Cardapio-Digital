import { OrderStatus, OrderType } from '@prisma/client'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { emit } from '../../shared/socket/socket'
import {
  sendMotoboyAssignedMessage,
  sendStatusUpdateMessage,
} from '../whatsapp/messages.service'
import { geocodeAddress } from '../menu/geocoding.service'
import { isPaymentOnDelivery } from '../../shared/utils/payment'

import { invalidateAnalyticsCache } from './analytics.service'
import { calculateDeliveryFee } from './delivery.service'
import type { AssignMotoboyInput, ListOrdersInput, UpdateOrderAddressInput, UpdateOrderStatusInput } from './orders.schema'
import { autoPrintOrder } from './print.service'
import { linkOrderToCashFlow } from './cashflow.service'

// ─── TASK-081: Listagem e Detalhes de Pedidos ────────────────────────────────

// Pedidos nascem em WAITING_PAYMENT_PROOF (PIX) ou WAITING_CONFIRMATION (demais meios).
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  WAITING_PAYMENT_PROOF: ['CONFIRMED', 'CANCELLED'],
  WAITING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['DISPATCHED', 'DELIVERED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
}

export async function listOrders(storeId: string, filters: ListOrdersInput) {
  const { status, paymentMethod, dateFrom, dateTo, cursor, limit } = filters

  const where: Record<string, unknown> = { storeId }

  if (status) {
    const statuses = status.split(',').map((s) => s.trim()).filter(Boolean)
    where.status = statuses.length === 1 ? statuses[0] : { in: statuses }
  }
  if (paymentMethod) where.paymentMethod = paymentMethod
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    }
  }

  const orders = await prisma.order.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: { additionals: true },
      },
      motoboy: { select: { id: true, name: true } },
      client: { select: { id: true, name: true, whatsapp: true } },
    },
  })

  let nextCursor: string | null = null
  if (orders.length > limit) {
    const last = orders.pop()!
    nextCursor = last.id
  }

  return { orders, nextCursor }
}

export async function getOrder(storeId: string, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { additionals: true },
      },
      motoboy: { select: { id: true, name: true, whatsapp: true } },
      client: { select: { id: true, name: true, whatsapp: true } },
      coupon: { select: { id: true, code: true } },
      paymentReceivedBy: { select: { id: true, name: true, role: true } },
    },
  })

  if (!order || order.storeId !== storeId) {
    throw new AppError('Pedido não encontrado', 404)
  }

  return order
}

// ─── A-046: Atualização de Endereço do Pedido ───────────────────────────────

const NON_EDITABLE_STATUSES = new Set<string>(['DISPATCHED', 'DELIVERED', 'CANCELLED'])

export async function updateOrderAddress(
  storeId: string,
  orderId: string,
  input: UpdateOrderAddressInput
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })

  if (!order || order.storeId !== storeId) {
    throw new AppError('Pedido não encontrado', 404)
  }

  if (order.type !== OrderType.DELIVERY) {
    throw new AppError('Endereço só pode ser editado em pedidos de entrega', 422)
  }

  if (NON_EDITABLE_STATUSES.has(order.status)) {
    throw new AppError('Endereço não pode ser alterado neste status', 422)
  }

  // Recalcula frete: geocodifica o novo endereço e calcula distância contra a loja.
  // Se geocoding/cálculo falhar (API fora, fora da área, sem faixas), mantém o frete atual.
  let deliveryFee = order.deliveryFee
  try {
    const coords = await geocodeAddress({
      cep: input.zipCode,
      street: input.street,
      number: input.number,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state ?? undefined,
    })
    const result = await calculateDeliveryFee(storeId, {
      latitude: coords.latitude,
      longitude: coords.longitude,
    })
    deliveryFee = result.fee
  } catch {
    // mantém frete atual
  }

  const total = order.subtotal - order.discount + deliveryFee

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { address: input, deliveryFee, total },
    include: {
      items: { include: { additionals: true } },
      motoboy: { select: { id: true, name: true, whatsapp: true } },
      client: { select: { id: true, name: true, whatsapp: true } },
      coupon: { select: { id: true, code: true } },
    },
  })

  return updated
}

// ─── TASK-082: Atualização de Status do Pedido ───────────────────────────────

export async function updateOrderStatus(
  storeId: string,
  orderId: string,
  input: UpdateOrderStatusInput,
  userId: string,
  ip?: string
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })

  if (!order || order.storeId !== storeId) {
    throw new AppError('Pedido não encontrado', 404)
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, slug: true, phone: true },
  })

  if (!store) throw new AppError('Loja não encontrada', 404)

  const newStatus = input.status as OrderStatus
  const allowedTransitions = STATUS_TRANSITIONS[order.status] ?? []

  if (!allowedTransitions.includes(newStatus)) {
    throw new AppError(
      `Transição de status inválida: ${order.status} → ${newStatus}`,
      422
    )
  }

  // Validate DISPATCHED only for DELIVERY orders
  if (newStatus === 'DISPATCHED' && order.type !== OrderType.DELIVERY) {
    throw new AppError('Status DISPATCHED é válido apenas para pedidos de entrega', 422)
  }

  // M-012: bloqueia DELIVERED se pagamento ainda não foi confirmado.
  // Cobre todos os métodos pagos (online ou na entrega) — confirmação registra
  // quem recebeu o pagamento (paymentReceivedBy) para auditoria.
  if (newStatus === 'DELIVERED' && order.paymentMethod !== 'PENDING' && !order.paymentReceivedAt) {
    throw new AppError(
      'É necessário confirmar o recebimento do pagamento antes de marcar como entregue',
      422
    )
  }

  // Build timestamp fields
  const now = new Date()
  const timestamps: Record<string, Date | string> = {}
  if (newStatus === 'CONFIRMED') timestamps.confirmedAt = now
  if (newStatus === 'READY') timestamps.preparedAt = now
  if (newStatus === 'DISPATCHED') timestamps.dispatchedAt = now
  if (newStatus === 'DELIVERED') timestamps.deliveredAt = now
  if (newStatus === 'CANCELLED') {
    timestamps.cancelledAt = now
    if (input.cancelReason) timestamps.cancellationReason = input.cancelReason
  }

  // Quando admin aprova comprovante Pix (WAITING_PAYMENT_PROOF → CONFIRMED),
  // já registra que o pagamento foi recebido por esse admin.
  if (
    order.status === 'WAITING_PAYMENT_PROOF' &&
    newStatus === 'CONFIRMED' &&
    !order.paymentReceivedAt
  ) {
    timestamps.paymentReceivedAt = now
    timestamps.paymentReceivedById = userId
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: newStatus,
      ...timestamps,
    },
    include: {
      items: { include: { additionals: true } },
      motoboy: { select: { id: true, name: true } },
      client: { select: { id: true, name: true, whatsapp: true } },
      coupon: { select: { id: true, code: true } },
      paymentReceivedBy: { select: { id: true, name: true, role: true } },
    },
  })

  // Invalida cache de analytics (status afeta agregações de vendas/cancelados)
  await invalidateAnalyticsCache(storeId)

  // Emit socket event
  emit.orderStatus(storeId, { orderId, status: newStatus })

  // Fire-and-forget WhatsApp notification
  if (order.clientWhatsapp) {
    sendStatusUpdateMessage(storeId, order.clientWhatsapp, order.number, newStatus, store.name, order.type, {
      total: updated.total,
      items: updated.items,
      // C-040: passa motivo do cancelamento pro template {{motivo}}
      cancelReason: newStatus === 'CANCELLED' ? input.cancelReason : undefined,
    }).catch((err) => console.error(`[WhatsApp] Error sending ${newStatus} to client:`, err))
  }

  // TASK-084: Auto-print when order is CONFIRMED (fire-and-forget, never breaks flow)
  if (newStatus === 'CONFIRMED') {
    setImmediate(() => autoPrintOrder(orderId))
    // TASK-095: Link confirmed order to open cash flow
    setImmediate(() => linkOrderToCashFlow(storeId, orderId).catch(() => void 0))
  }

  // AuditLog
  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'order.status_update',
      entity: 'Order',
      entityId: orderId,
      data: { previousStatus: order.status, newStatus, cancelReason: input.cancelReason },
      ip,
    },
  })

  return updated
}

// ─── TASK-085: Atribuição de Motoboy ─────────────────────────────────────────

export async function assignMotoboy(
  storeId: string,
  orderId: string,
  input: AssignMotoboyInput,
  userId: string,
  ip?: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { additionals: true } },
      client: { select: { id: true, name: true, whatsapp: true } },
      store: { select: { id: true, slug: true, name: true } },
    },
  })

  if (!order || order.storeId !== storeId) {
    throw new AppError('Pedido não encontrado', 404)
  }

  if (order.status !== 'READY') {
    throw new AppError('O pedido precisa estar com status READY para atribuir motoboy', 422)
  }

  if (order.type !== OrderType.DELIVERY) {
    throw new AppError('Motoboy só pode ser atribuído a pedidos de entrega', 422)
  }

  const motoboy = await prisma.user.findFirst({
    where: { id: input.motoboyId, storeId, role: 'MOTOBOY' },
    select: { id: true, name: true, whatsapp: true },
  })

  if (!motoboy) {
    throw new AppError('Motoboy não encontrado nesta loja', 404)
  }

  const now = new Date()
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      motoboyId: motoboy.id,
      status: 'DISPATCHED',
      dispatchedAt: now,
    },
    include: {
      items: { include: { additionals: true } },
      motoboy: { select: { id: true, name: true, whatsapp: true } },
      client: { select: { id: true, name: true, whatsapp: true } },
      coupon: { select: { id: true, code: true } },
    },
  })

  // Emit socket event
  emit.orderStatus(storeId, { orderId, status: 'DISPATCHED' })

  // Fire-and-forget WhatsApp to motoboy
  if (motoboy.whatsapp) {
    sendMotoboyAssignedMessage(storeId, motoboy.whatsapp, {
      number: order.number,
      clientName: order.clientName,
      clientWhatsapp: order.clientWhatsapp,
      address: order.address as Record<string, string> | null,
      items: order.items.map(item => ({
        productName: item.productName,
        variationName: item.variationName,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        additionals: item.additionals.map(a => ({ name: a.name, price: a.price })),
      })),
      total: order.total,
      paymentMethod: order.paymentMethod,
      store: { slug: order.store.slug },
    }).catch((err) => console.error('[WhatsApp] Error sending motoboy message:', err))
  }

  // Fire-and-forget WhatsApp DISPATCHED notification to customer
  if (order.clientWhatsapp) {
    console.log(`[WhatsApp] assignMotoboy → sending DISPATCHED to client ${order.clientWhatsapp} for order #${order.number}`)
    sendStatusUpdateMessage(storeId, order.clientWhatsapp, order.number, 'DISPATCHED', order.store.name, order.type, {
      total: updated.total,
      items: updated.items,
    }).catch((err) => console.error('[WhatsApp] Error sending DISPATCHED to client:', err))
  } else {
    console.warn(`[WhatsApp] assignMotoboy → order #${order.number} has no clientWhatsapp, skipping DISPATCHED notification`)
  }

  // AuditLog
  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'order.motoboy_assigned',
      entity: 'Order',
      entityId: orderId,
      data: { motoboyId: motoboy.id, motoboyName: motoboy.name },
      ip,
    },
  })

  return updated
}

// ─── M-012: Confirmação de Recebimento de Pagamento ──────────────────────────

/**
 * Registra que o pagamento do pedido foi recebido por `userId`.
 * Usado por admin (após motoboy retornar) e pelo próprio motoboy no app.
 *
 * Idempotente: se já estava confirmado, retorna o pedido sem alterar.
 * Não altera o status do pedido — apenas marca o recebimento.
 */
export async function confirmOrderPayment(
  storeId: string,
  orderId: string,
  userId: string,
  ip?: string
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })

  if (!order || order.storeId !== storeId) {
    throw new AppError('Pedido não encontrado', 404)
  }

  if (order.status === 'CANCELLED') {
    throw new AppError('Não é possível confirmar pagamento de pedido cancelado', 422)
  }

  if (order.paymentMethod === 'PENDING') {
    throw new AppError('Defina a forma de pagamento antes de confirmar o recebimento', 422)
  }

  if (order.paymentReceivedAt) {
    // Idempotente: já confirmado
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { additionals: true } },
        motoboy: { select: { id: true, name: true } },
        client: { select: { id: true, name: true, whatsapp: true } },
        paymentReceivedBy: { select: { id: true, name: true, role: true } },
      },
    })
  }

  const now = new Date()
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentReceivedAt: now,
      paymentReceivedById: userId,
    },
    include: {
      items: { include: { additionals: true } },
      motoboy: { select: { id: true, name: true } },
      client: { select: { id: true, name: true, whatsapp: true } },
      paymentReceivedBy: { select: { id: true, name: true, role: true } },
    },
  })

  emit.orderStatus(storeId, { orderId, status: order.status })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'order.payment_received',
      entity: 'Order',
      entityId: orderId,
      data: { paymentMethod: order.paymentMethod, onDelivery: isPaymentOnDelivery(order.paymentMethod) },
      ip,
    },
  })

  return updated
}
