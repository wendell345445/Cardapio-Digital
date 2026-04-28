// ─── A-056: Comanda pública do cliente — Controllers ─────────────────────────
// TASK-130: substitui auth por cookie OTP por header x-customer-session-id.
// Cliente envia o sessionId (UUID localStorage) que casou no createOrder.
// Garantimos que pelo menos um Order da mesa pertence à mesma sessão.

import { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'

import { getCustomerComanda, requestTableCheck } from './comanda.service'

const getComandaQuerySchema = z.object({
  tableNumber: z.coerce.number().int().positive(),
})

const requestCheckSchema = z.object({
  tableNumber: z.coerce.number().int().positive(),
})

function readSessionId(req: Request): string | null {
  const header = req.headers['x-customer-session-id']
  if (typeof header === 'string' && header.length >= 8) return header
  if (Array.isArray(header) && header[0] && header[0].length >= 8) return header[0]
  return null
}

async function ensureSessionOwnsTable(
  storeId: string,
  tableNumber: number,
  sessionId: string
): Promise<{ tableId: string; clientWhatsapp: string | null }> {
  const table = await prisma.table.findUnique({
    where: { storeId_number: { storeId, number: tableNumber } },
  })
  if (!table) throw new AppError('Mesa não encontrada', 404)

  const order = await prisma.order.findFirst({
    where: {
      storeId,
      tableId: table.id,
      customerSessionId: sessionId,
      status: { not: 'CANCELLED' },
    },
    orderBy: { createdAt: 'desc' },
    select: { clientWhatsapp: true },
  })
  if (!order) throw new AppError('Sessão não tem pedidos nessa mesa', 403)

  return { tableId: table.id, clientWhatsapp: order.clientWhatsapp }
}

export async function getCustomerComandaController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const storeId = req.store!.id
    const sessionId = readSessionId(req)
    if (!sessionId) {
      res.status(401).json({ success: false, error: 'Sessão não identificada' })
      return
    }

    const { tableNumber } = getComandaQuerySchema.parse(req.query)
    await ensureSessionOwnsTable(storeId, tableNumber, sessionId)
    const data = await getCustomerComanda(storeId, tableNumber)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function requestCheckController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const storeId = req.store!.id
    const sessionId = readSessionId(req)
    if (!sessionId) {
      res.status(401).json({ success: false, error: 'Sessão não identificada' })
      return
    }

    const { tableNumber } = requestCheckSchema.parse(req.body)
    const { clientWhatsapp } = await ensureSessionOwnsTable(storeId, tableNumber, sessionId)
    await requestTableCheck(storeId, tableNumber, clientWhatsapp)

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
