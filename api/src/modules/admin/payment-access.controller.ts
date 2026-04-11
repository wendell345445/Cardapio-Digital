import { NextFunction, Request, Response } from 'express'

import type { JwtPayload } from '../../shared/middleware/auth.middleware'

import { addPaymentAccessSchema } from './payment-access.schema'
import {
  addPaymentAccess,
  listStoreClients,
  removePaymentAccess,
} from './payment-access.service'

// ─── TASK-054: Blacklist e Whitelist de Clientes ─────────────────────────────

function getUser(req: Request): JwtPayload {
  return req.user as unknown as JwtPayload
}

export async function listStoreClientsController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const result = await listStoreClients(storeId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function addPaymentAccessController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const data = addPaymentAccessSchema.parse(req.body)
    const result = await addPaymentAccess(storeId, data, userId, req.ip)
    res.status(201).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function removePaymentAccessController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { clientId } = req.params
    await removePaymentAccess(storeId, clientId, userId, req.ip)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
