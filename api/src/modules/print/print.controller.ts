import type { NextFunction, Request, Response } from 'express'

import { AppError } from '../../shared/middleware/error.middleware'

import {
  getPrinterMe,
  listPendingPrintJobs,
  markPrintJobPrinted,
  printerLogin,
  verifyPrinterToken,
} from './print.service'
import { markPrintedSchema, printerLoginSchema } from './print.schema'

// O Menuziprinter espera success: true/false no envelope (ver electron/ipc/settings.ts)
// — distinto do envelope { success, data } usado em /api/v1/admin/*.

export async function printerLoginController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = printerLoginSchema.parse(req.body)
    const result = await printerLogin(input.email, input.password)
    res.json({ success: true, token: result.token, restaurant: result.restaurant })
  } catch (err) {
    next(err)
  }
}

/**
 * Middleware específico do printer: valida JWT scope='print' e popula
 * req.printer com { storeId, userId }. Não usamos authMiddleware do admin
 * porque o token aqui tem escopo restrito e não passa pelas regras de
 * single-session do admin.
 */
export function printerAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized', 401))
  }
  try {
    const payload = verifyPrinterToken(authorization.slice(7))
    req.printer = { storeId: payload.storeId, userId: payload.userId }
    next()
  } catch (err) {
    next(err)
  }
}

export async function printerMeController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const restaurant = await getPrinterMe(req.printer!.storeId)
    res.json({ success: true, restaurant })
  } catch (err) {
    next(err)
  }
}

export async function printerPendingController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orders = await listPendingPrintJobs(req.printer!.storeId)
    res.json({ success: true, orders })
  } catch (err) {
    next(err)
  }
}

export async function printerMarkPrintedController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = markPrintedSchema.parse(req.body)
    await markPrintJobPrinted(req.printer!.storeId, input.orderId)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
