import { NextFunction, Request, Response } from 'express'

import { AppError } from '../../shared/middleware/error.middleware'

import {
  checkCustomer,
  verifyCustomerToken,
  getCookieValue,
  COOKIE_NAME,
} from './customer-verify.service'
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
    const store = req.store!
    const data = createOrderSchema.parse(req.body)

    // Verificação de cliente: cookie válido OU cliente já existente
    const cookieValue = getCookieValue(req.headers.cookie, COOKIE_NAME)
    let verified = false

    if (cookieValue) {
      const payload = verifyCustomerToken(cookieValue)
      if (payload && payload.storeId === store.id && payload.whatsapp === data.clientWhatsapp) {
        verified = true
      }
    }

    if (!verified) {
      const check = await checkCustomer(store.id, data.clientWhatsapp)
      verified = check.exists
    }

    if (!verified) {
      throw new AppError('Número não verificado. Faça a verificação por WhatsApp.', 403, 'VERIFICATION_REQUIRED')
    }

    const result = await createOrder(store.slug, data)
    res.status(201).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
