// ─── A-056: Comanda pública do cliente — Controllers ─────────────────────────

import { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import {
  COOKIE_NAME,
  getCookieValue,
  verifyCustomerToken,
} from './customer-verify.service'
import { getCustomerComanda, requestTableCheck } from './comanda.service'

const getComandaQuerySchema = z.object({
  tableNumber: z.coerce.number().int().positive(),
})

const requestCheckSchema = z.object({
  tableNumber: z.coerce.number().int().positive(),
})

export async function getCustomerComandaController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const storeId = req.store!.id
    const cookieValue = getCookieValue(req.headers.cookie, COOKIE_NAME)

    if (!cookieValue) {
      res.status(401).json({ success: false, error: 'Não autenticado' })
      return
    }

    const payload = verifyCustomerToken(cookieValue)
    if (!payload || payload.storeId !== storeId) {
      res.status(401).json({ success: false, error: 'Token inválido' })
      return
    }

    const { tableNumber } = getComandaQuerySchema.parse(req.query)
    const data = await getCustomerComanda(storeId, tableNumber)

    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function requestCheckController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const storeId = req.store!.id
    const cookieValue = getCookieValue(req.headers.cookie, COOKIE_NAME)

    if (!cookieValue) {
      res.status(401).json({ success: false, error: 'Não autenticado' })
      return
    }

    const payload = verifyCustomerToken(cookieValue)
    if (!payload || payload.storeId !== storeId) {
      res.status(401).json({ success: false, error: 'Token inválido' })
      return
    }

    const { tableNumber } = requestCheckSchema.parse(req.body)
    await requestTableCheck(storeId, tableNumber, payload.whatsapp)

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
