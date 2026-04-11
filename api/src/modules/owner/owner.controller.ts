import { NextFunction, Request, Response } from 'express'

import type { JwtPayload } from '../../shared/middleware/auth.middleware'

import {
  auditLogsQuerySchema,
  createStoreSchema,
  listStoresSchema,
  updateStorePlanSchema,
  updateStoreSchema,
} from './owner.schema'
import {
  cancelStore,
  createStore,
  endTrialNow,
  getAuditLogs,
  getStore,
  listStores,
  updateStore,
  updateStorePlan,
} from './owner.service'

function getUser(req: Request): JwtPayload {
  return req.user as unknown as JwtPayload
}

export async function listStoresController(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = listStoresSchema.parse(req.query)
    const result = await listStores(status)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function createStoreController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createStoreSchema.parse(req.body)
    const store = await createStore(data, getUser(req).userId, req.ip)
    res.status(201).json({ success: true, data: store })
  } catch (err) {
    next(err)
  }
}

export async function getStoreController(req: Request, res: Response, next: NextFunction) {
  try {
    const store = await getStore(req.params.id)
    res.json({ success: true, data: store })
  } catch (err) {
    next(err)
  }
}

export async function updateStoreController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateStoreSchema.parse(req.body)
    const store = await updateStore(req.params.id, data, getUser(req).userId, req.ip)
    res.json({ success: true, data: store })
  } catch (err) {
    next(err)
  }
}

export async function cancelStoreController(req: Request, res: Response, next: NextFunction) {
  try {
    const store = await cancelStore(req.params.id, getUser(req).userId, req.ip)
    res.json({ success: true, data: store })
  } catch (err) {
    next(err)
  }
}

export async function updateStorePlanController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateStorePlanSchema.parse(req.body)
    const store = await updateStorePlan(req.params.id, data, getUser(req).userId, req.ip)
    res.json({ success: true, data: store })
  } catch (err) {
    next(err)
  }
}

export async function getAuditLogsController(req: Request, res: Response, next: NextFunction) {
  try {
    const params = auditLogsQuerySchema.parse(req.query)
    const result = await getAuditLogs(req.params.id, params)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

// ─── OWNER TOOL ───────────────────────────────────────────────────────────────
// POST /owner/stores/:id/dev/end-trial — ação operacional do Owner, disponível
// em todos os ambientes. Encerra o trial no Stripe + dispara sweep imediato.

export async function endTrialNowController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await endTrialNow(req.params.id, getUser(req).userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
