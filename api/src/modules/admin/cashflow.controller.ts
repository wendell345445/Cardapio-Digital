import { NextFunction, Request, Response } from 'express'

import type { JwtPayload } from '../../shared/middleware/auth.middleware'

import {
  adjustmentSchema,
  closeCashFlowSchema,
  openCashFlowSchema,
  updateInitialAmountSchema,
} from './cashflow.schema'
import {
  addAdjustment,
  closeCashFlow,
  getCashFlowSummary,
  getCurrentCashFlow,
  listCashFlows,
  openCashFlow,
  updateInitialAmount,
} from './cashflow.service'

// ─── TASK-095: Controllers de Controle de Caixa ──────────────────────────────

function getUser(req: Request): JwtPayload {
  return req.user as unknown as JwtPayload
}

export async function listCashFlowsController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    res.json({ success: true, data: await listCashFlows(storeId) })
  } catch (err) {
    next(err)
  }
}

export async function getCurrentCashFlowController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    res.json({ success: true, data: await getCurrentCashFlow(storeId) })
  } catch (err) {
    next(err)
  }
}

export async function openCashFlowController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const input = openCashFlowSchema.parse(req.body)
    const cf = await openCashFlow(storeId, input, userId, req.ip)
    res.status(201).json({ success: true, data: cf })
  } catch (err) {
    next(err)
  }
}

export async function updateInitialAmountController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const input = updateInitialAmountSchema.parse(req.body)
    const cf = await updateInitialAmount(storeId, req.params.id, input, userId, req.ip)
    res.json({ success: true, data: cf })
  } catch (err) {
    next(err)
  }
}

export async function addAdjustmentController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const input = adjustmentSchema.parse(req.body)
    const adj = await addAdjustment(storeId, req.params.id, input, userId, req.ip)
    res.status(201).json({ success: true, data: adj })
  } catch (err) {
    next(err)
  }
}

export async function getCashFlowSummaryController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const data = await getCashFlowSummary(storeId, req.params.id)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function closeCashFlowController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const input = closeCashFlowSchema.parse(req.body)
    const result = await closeCashFlow(storeId, req.params.id, input, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
