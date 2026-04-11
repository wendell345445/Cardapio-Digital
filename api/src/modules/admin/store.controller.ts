import { NextFunction, Request, Response } from 'express'

import type { JwtPayload } from '../../shared/middleware/auth.middleware'

import {
  updateStoreSchema,
  updateBusinessHoursSchema,
  updateStoreStatusSchema,
  updateWhatsappSchema,
  updatePixSchema,
  updatePaymentSettingsSchema,
} from './store.schema'
import {
  getStore,
  updateStore,
  getBusinessHours,
  updateBusinessHours,
  updateStoreStatus,
  updateWhatsapp,
  updatePix,
  updatePaymentSettings,
} from './store.service'

// ─── TASK-050: Configurações da Loja ─────────────────────────────────────────

function getUser(req: Request): JwtPayload {
  return req.user as unknown as JwtPayload
}

export async function getStoreController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const result = await getStore(storeId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function updateStoreController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const data = updateStoreSchema.parse(req.body)
    const result = await updateStore(storeId, data, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function getBusinessHoursController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const result = await getBusinessHours(storeId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function updateBusinessHoursController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { hours } = updateBusinessHoursSchema.parse(req.body)
    const result = await updateBusinessHours(storeId, hours, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function updateStoreStatusController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const data = updateStoreStatusSchema.parse(req.body)
    const result = await updateStoreStatus(storeId, data, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

// ─── TASK-051: WhatsApp e Pix (reauth) ───────────────────────────────────────

export async function updateWhatsappController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const data = updateWhatsappSchema.parse(req.body)
    const result = await updateWhatsapp(storeId, data, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function updatePixController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const data = updatePixSchema.parse(req.body)
    const result = await updatePix(storeId, data, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

// ─── TASK-052: Formas de Pagamento e Retirada ─────────────────────────────────

export async function updatePaymentSettingsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const data = updatePaymentSettingsSchema.parse(req.body)
    const result = await updatePaymentSettings(storeId, data, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
