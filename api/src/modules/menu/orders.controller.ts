import { NextFunction, Request, Response } from 'express'

import { createOrderSchema } from './orders.schema'
import { createOrder, listOrdersBySession } from './orders.service'

// ─── TASK-065 / TASK-130: Pedidos Públicos ────────────────────────────────────
// ─── TASK-122: slug vem de req.store (subdomain middleware) ──────────────────

export async function createOrderController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const store = req.store!
    const data = createOrderSchema.parse(req.body)

    const result = await createOrder(store.slug, data)
    res.status(201).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

// GET /menu/orders/by-session/:sessionId
// Lista pedidos da sessão do navegador (sem login). O sessionId é gerado
// no client (UUID em localStorage) e enviado no createOrder; quem tiver o ID
// vê os pedidos — equivalente a um magic link de "minha lista".
export async function listOrdersBySessionController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const store = req.store!
    const { sessionId } = req.params
    if (!sessionId || sessionId.length < 8) {
      res.status(400).json({ success: false, error: 'sessionId inválido' })
      return
    }
    const orders = await listOrdersBySession(store.id, sessionId)
    res.json({ success: true, data: orders })
  } catch (err) {
    next(err)
  }
}
