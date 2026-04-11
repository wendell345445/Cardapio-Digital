import { NextFunction, Request, Response } from 'express'

import type { JwtPayload } from '../../shared/middleware/auth.middleware'

import { listMotoboyOrders, markDelivered } from './motoboy.service'

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
