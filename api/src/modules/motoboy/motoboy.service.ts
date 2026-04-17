import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { emit } from '../../shared/socket/socket'
import { sendStatusUpdateMessage } from '../whatsapp/messages.service'

// ─── TASK-083: Serviço do Motoboy ────────────────────────────────────────────

/**
 * Lists orders for a motoboy by tab:
 *  - 'active'  → DISPATCHED orders assigned to this motoboy
 *  - 'history' → DELIVERED orders of today (America/Sao_Paulo) assigned to this motoboy
 */
export async function listMotoboyOrders(
  storeId: string,
  motoboyId: string,
  tab: 'active' | 'history'
) {
  let where: Record<string, unknown>

  if (tab === 'active') {
    where = {
      storeId,
      motoboyId,
      status: 'DISPATCHED',
    }
  } else {
    // Start of today in America/Sao_Paulo
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const [year, month, day] = formatter.format(now).split('-').map(Number)
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 3, 0, 0)) // UTC-3

    where = {
      storeId,
      motoboyId,
      status: 'DELIVERED',
      createdAt: { gte: startOfDay },
    }
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      items: { include: { additionals: true } },
      client: { select: { id: true, name: true, whatsapp: true } },
      store: { select: { id: true, name: true, slug: true } },
    },
  })

  return orders
}

/**
 * Marks a DISPATCHED order as DELIVERED.
 * Validates ownership (storeId, motoboyId) and current status.
 */
export async function markDelivered(
  storeId: string,
  orderId: string,
  motoboyId: string,
  userId: string,
  ip?: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: { select: { id: true, name: true, whatsapp: true } },
    },
  })

  if (!order || order.storeId !== storeId) {
    throw new AppError('Pedido não encontrado', 404)
  }

  if (order.motoboyId !== motoboyId) {
    throw new AppError('Este pedido não está atribuído a você', 422)
  }

  if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
    throw new AppError(`Pedido já está com status ${order.status}`, 422)
  }

  if (order.status !== 'DISPATCHED') {
    throw new AppError('O pedido precisa estar com status DISPATCHED para marcar como entregue', 422)
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true },
  })

  if (!store) throw new AppError('Loja não encontrada', 404)

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'DELIVERED',
      deliveredAt: new Date(),
    },
    include: {
      items: { include: { additionals: true } },
      client: { select: { id: true, name: true, whatsapp: true } },
      store: { select: { id: true, name: true, slug: true } },
    },
  })

  // Emit socket event
  emit.orderStatus(storeId, { orderId, status: 'DELIVERED' })

  // Fire-and-forget WhatsApp notification
  if (order.clientWhatsapp) {
    sendStatusUpdateMessage(storeId, order.clientWhatsapp, order.number, 'DELIVERED', store.name).catch(
      () => void 0
    )
  }

  // AuditLog
  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'order.delivered',
      entity: 'Order',
      entityId: orderId,
      data: { motoboyId, previousStatus: order.status },
      ip,
    },
  })

  return updated
}

/**
 * Reports a delivery problem. Motoboy could not complete delivery.
 * Sets order back to READY, clears motoboyId, stores reason.
 */
export async function reportDeliveryProblem(
  storeId: string,
  orderId: string,
  motoboyId: string,
  reason: string,
  userId: string,
  ip?: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  })

  if (!order || order.storeId !== storeId) {
    throw new AppError('Pedido não encontrado', 404)
  }

  if (order.motoboyId !== motoboyId) {
    throw new AppError('Este pedido não está atribuído a você', 422)
  }

  if (order.status !== 'DISPATCHED') {
    throw new AppError('Só é possível reportar problema em pedidos despachados', 422)
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'READY',
      motoboyId: null,
      dispatchedAt: null,
      deliveryIssueReason: reason,
    },
    include: {
      items: { include: { additionals: true } },
      client: { select: { id: true, name: true, whatsapp: true } },
      store: { select: { id: true, name: true, slug: true } },
    },
  })

  // Notify admin via socket
  emit.orderStatus(storeId, { orderId, status: 'READY' })

  // AuditLog
  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'order.delivery_problem',
      entity: 'Order',
      entityId: orderId,
      data: { motoboyId, reason, previousStatus: order.status },
      ip,
    },
  })

  return updated
}
