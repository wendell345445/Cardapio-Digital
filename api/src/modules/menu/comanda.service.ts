// ─── A-056: Comanda pública do cliente ───────────────────────────────────────

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { emit } from '../../shared/socket/socket'

export async function getCustomerComanda(storeId: string, tableNumber: number) {
  const table = await prisma.table.findUnique({
    where: { storeId_number: { storeId, number: tableNumber } },
  })
  if (!table) {
    throw new AppError('Mesa não encontrada', 404)
  }

  const orders = await prisma.order.findMany({
    where: {
      tableId: table.id,
      storeId,
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
    table: { id: table.id, number: table.number },
    orders: orders.map((o) => ({ id: o.id, number: o.number, createdAt: o.createdAt })),
    items,
    subtotal,
    total: subtotal,
    storeId,
  }
}

export async function requestTableCheck(
  storeId: string,
  tableNumber: number,
  customerWhatsapp: string | null
) {
  const table = await prisma.table.findUnique({
    where: { storeId_number: { storeId, number: tableNumber } },
  })
  if (!table) {
    throw new AppError('Mesa não encontrada', 404)
  }
  if (!table.isOccupied) {
    throw new AppError('Mesa não possui comanda aberta', 422)
  }

  emit.tableCheckRequested(storeId, {
    tableId: table.id,
    tableNumber: table.number,
    customerWhatsapp: customerWhatsapp ?? '',
  })

  return { success: true }
}
