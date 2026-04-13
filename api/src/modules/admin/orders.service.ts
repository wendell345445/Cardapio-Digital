import { OrderStatus, OrderType } from '@prisma/client'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { emit } from '../../shared/socket/socket'
import {
  sendMotoboyAssignedMessage,
  sendStatusUpdateMessage,
} from '../whatsapp/messages.service'

import { invalidateAnalyticsCache } from './analytics.service'
import type { AssignMotoboyInput, ListOrdersInput, UpdateOrderStatusInput } from './orders.schema'
import { autoPrintOrder } from './print.service'
import { linkOrderToCashFlow } from './cashflow.service'

// ─── TASK-081: Listagem e Detalhes de Pedidos ────────────────────────────────

/** Valid status transitions map */
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'WAITING_CONFIRMATION', 'CANCELLED'],
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
    },
  })

  if (!order || order.storeId !== storeId) {
    throw new AppError('Pedido não encontrado', 404)
  }

  return order
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

  // Build timestamp fields
  const now = new Date()
  const timestamps: Record<string, Date> = {}
  if (newStatus === 'CONFIRMED') timestamps.confirmedAt = now
  if (newStatus === 'READY') timestamps.preparedAt = now
  if (newStatus === 'DISPATCHED') timestamps.dispatchedAt = now
  if (newStatus === 'DELIVERED') timestamps.deliveredAt = now
  if (newStatus === 'CANCELLED') timestamps.cancelledAt = now

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
    }).catch(() => void 0)
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

// ─── TASK-123: Botão "Aguardando Pix" — Disparo manual ───────────────────────

/**
 * Envia mensagem WhatsApp "Aguardando Pix" manualmente para pedidos de entrega.
 * Não muda o status do pedido (mantém PENDING na coluna "Novos").
 * Somente aplicável a pedidos de entrega (não retirada).
 */
export async function sendWaitingPaymentNotification(
  storeId: string,
  orderId: string,
  userId: string,
  ip?: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, storeId: true, type: true, status: true, clientWhatsapp: true, number: true },
  })

  if (!order || order.storeId !== storeId) {
    throw new AppError('Pedido não encontrado', 404)
  }

  if (order.type !== OrderType.DELIVERY) {
    throw new AppError('Mensagem de Aguardando Pix não se aplica a pedidos de retirada', 400)
  }

  if (order.status !== 'PENDING') {
    throw new AppError('Mensagem de Aguardando Pix só pode ser enviada para pedidos no status Novo', 400)
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { name: true },
  })

  if (!store) throw new AppError('Loja não encontrada', 404)

  // Fire-and-forget WhatsApp
  if (order.clientWhatsapp) {
    sendStatusUpdateMessage(storeId, order.clientWhatsapp, order.number, 'WAITING_PAYMENT', store.name).catch(
      () => void 0
    )
  }

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'order.send_waiting_payment',
      entity: 'Order',
      entityId: orderId,
      data: {},
      ip,
    },
  })

  return { success: true }
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
      store: { select: { id: true, slug: true } },
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
    }).catch(() => void 0)
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
