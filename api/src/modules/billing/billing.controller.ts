import { NextFunction, Request, Response } from 'express'

import { AppError } from '../../shared/middleware/error.middleware'

import {
  changePlan,
  createCheckoutSession,
  createPixAutoSubscription,
  getChangePlanPreview,
  getPixAutoStatus,
} from './billing.service'

function requireStoreId(req: Request): string {
  if (!req.tenant?.storeId) throw new AppError('Store context required', 403)
  return req.tenant.storeId
}

function parseTargetPlan(v: unknown): 'PROFESSIONAL' | 'PREMIUM' {
  if (v === 'PROFESSIONAL' || v === 'PREMIUM') return v
  throw new AppError('targetPlan inválido (PROFESSIONAL | PREMIUM)', 400)
}

/**
 * POST /api/v1/billing/checkout-session — assinatura por CARTÃO.
 * Retorna `{ url }` do Checkout hospedado do Asaas; o front redireciona.
 */
export async function createCheckoutSessionController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = requireStoreId(req)
    const webUrl = process.env.WEB_URL || 'http://localhost:5173'
    const result = await createCheckoutSession(storeId, webUrl)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/billing/pix-auto — assinatura por PIX Automático.
 * Retorna `{ authId, status, qrPayload, qrImage }` pro front exibir o QR de autorização.
 */
export async function createPixAutoController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = requireStoreId(req)
    const result = await createPixAutoSubscription(storeId)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/billing/pix-auto/status — status da autorização PIX Automático (polling).
 */
export async function getPixAutoStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = requireStoreId(req)
    const result = await getPixAutoStatus(storeId)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/billing/change-plan/preview?targetPlan=PREMIUM — mostra o que será cobrado
 * (pro-rata no upgrade; 0 no downgrade) antes do lojista confirmar.
 */
export async function changePlanPreviewController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = requireStoreId(req)
    const targetPlan = parseTargetPlan(req.query.targetPlan)
    res.json(await getChangePlanPreview(storeId, targetPlan))
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/billing/change-plan { targetPlan } — executa upgrade (cobra pro-rata) ou
 * downgrade (agenda pro próximo ciclo).
 */
export async function changePlanController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = requireStoreId(req)
    const targetPlan = parseTargetPlan((req.body as { targetPlan?: unknown })?.targetPlan)
    res.json(await changePlan(storeId, targetPlan))
  } catch (err) {
    next(err)
  }
}
