import { NextFunction, Request, Response } from 'express'

import type { JwtPayload } from '../../shared/middleware/auth.middleware'

import { confirmMotoboyPayment, listMotoboyOrders, markDelivered, reportDeliveryProblem } from './motoboy.service'

// ─── TASK-083: Controllers do Motoboy ────────────────────────────────────────

function getUser(req: Request): JwtPayload {
  return req.user as unknown as JwtPayload
}

/**
 * GET /:slug/motoboy/orders?tab=active|history
 */
export async function listOrdersController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const tab = (req.query.tab as string) === 'history' ? 'history' : 'active'

    const orders = await listMotoboyOrders(storeId, userId, tab)
    res.json({ success: true, data: orders })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /:slug/motoboy/orders/:id/deliver
 */
export async function markDeliveredController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { id } = req.params

    const order = await markDelivered(storeId, id, userId, userId, req.ip)
    res.json({ success: true, data: order })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /:slug/motoboy/orders/:id/report-problem
 */
export async function reportProblemController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { id } = req.params
    const { reason } = req.body

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      res.status(400).json({ success: false, error: 'Motivo é obrigatório' })
      return
    }

    const order = await reportDeliveryProblem(storeId, id, userId, reason.trim(), userId, req.ip)
    res.json({ success: true, data: order })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /motoboy/orders/:id/confirm-payment
 * M-012: motoboy confirma que recebeu o pagamento na entrega.
 */
export async function confirmPaymentController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { id } = req.params

    const order = await confirmMotoboyPayment(storeId, id, userId, req.ip)
    res.json({ success: true, data: order })
  } catch (err) {
    next(err)
  }
}
