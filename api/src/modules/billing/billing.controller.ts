import { NextFunction, Request, Response } from 'express'

import { AppError } from '../../shared/middleware/error.middleware'

import { createPortalSession } from './billing.service'

/**
 * POST /api/v1/billing/portal-session
 * Cria uma Stripe Customer Portal session para o admin da loja autenticada.
 * O frontend redireciona pro `url` retornado; o Stripe redireciona de volta
 * pra `returnUrl` (default: WEB_URL/admin/configuracoes).
 */
export async function createPortalSessionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.tenant?.storeId) {
      throw new AppError('Store context required', 403)
    }

    const webUrl = process.env.WEB_URL || 'http://localhost:5173'
    const returnUrl = `${webUrl}/admin/configuracoes`

    const result = await createPortalSession(req.tenant.storeId, returnUrl)
    res.json(result)
  } catch (err) {
    next(err)
  }
}
