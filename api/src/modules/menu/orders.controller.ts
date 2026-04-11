import { NextFunction, Request, Response } from 'express'

import { createOrderSchema } from './orders.schema'
import { createOrder } from './orders.service'

// ─── TASK-065: Pedidos Públicos ───────────────────────────────────────────────
// ─── TASK-122: slug vem de req.store (subdomain middleware) ──────────────────

export async function createOrderController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { slug } = req.store!
    const data = createOrderSchema.parse(req.body)
    const result = await createOrder(slug, data)
    res.status(201).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
