// ─── A-056: Comanda pública do cliente ───────────────────────────────────────

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { emit } from '../../shared/socket/socket'

export async function getCustomerComandaBySession(storeId: string, sessionToken: string) {
  const session = await prisma.tableSession.findUnique({
    where: { token: sessionToken },
    include: { table: true },
  })
  if (!session || session.storeId !== storeId) {
    throw new AppError('Sessão de mesa não encontrada', 404)
  }
  if (session.status !== 'OPEN') {
    throw new AppError('Esta mesa já foi fechada', 410)
  }

  const orders = await prisma.order.findMany({
    where: {
      tableSessionId: session.id,
      status: { not: 'CANCELLED' },
    },
    include: {
      items: {
        include: { additionals: true },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const items = orders.flatMap((o) => o.items)
  const subtotal = items.reduce((acc, item) => acc + item.totalPrice, 0)

  return {
    table: { id: session.table.id, number: session.table.number },
    sessionId: session.id,
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      createdAt: o.createdAt,
      deviceName: o.deviceName,
    })),
    items,
    subtotal,
    total: subtotal,
    storeId,
  }
}

export async function requestTableCheckBySession(
  storeId: string,
  sessionToken: string,
  customerWhatsapp: string | null
) {
  const session = await prisma.tableSession.findUnique({
    where: { token: sessionToken },
    include: { table: true },
  })
  if (!session || session.storeId !== storeId) {
    throw new AppError('Sessão de mesa não encontrada', 404)
  }
  if (session.status !== 'OPEN') {
    throw new AppError('Esta mesa já foi fechada', 410)
  }

  // Idempotente: se já tem checkRequestedAt, mantém o original (não reseta o
  // relógio no admin). Cliente pode clicar várias vezes sem efeito colateral.
  const checkRequestedAt = session.checkRequestedAt ?? new Date()
  if (!session.checkRequestedAt) {
    await prisma.tableSession.update({
      where: { id: session.id },
      data: { checkRequestedAt },
    })
  }

  emit.tableCheckRequested(storeId, {
    tableId: session.table.id,
    tableNumber: session.table.number,
    customerWhatsapp: customerWhatsapp ?? '',
  })

  return { success: true }
}
