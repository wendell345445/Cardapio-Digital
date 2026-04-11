import { NextFunction, Request, Response } from 'express'

import type { JwtPayload } from '../../shared/middleware/auth.middleware'

import { createCouponSchema, listCouponsSchema, updateCouponSchema } from './coupons.schema'
import {
  createCoupon,
  deleteCoupon,
  getCoupon,
  listCoupons,
  updateCoupon,
} from './coupons.service'

// ─── TASK-090: Controllers de Cupons Admin ───────────────────────────────────

function getUser(req: Request): JwtPayload {
  return req.user as unknown as JwtPayload
}

export async function listCouponsController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const filters = listCouponsSchema.parse(req.query)
    const coupons = await listCoupons(storeId, filters)
    res.json({ success: true, data: coupons })
  } catch (err) {
    next(err)
  }
}

export async function getCouponController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const coupon = await getCoupon(storeId, req.params.id)
    res.json({ success: true, data: coupon })
  } catch (err) {
    next(err)
  }
}

export async function createCouponController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const input = createCouponSchema.parse(req.body)
    const coupon = await createCoupon(storeId, input, userId, req.ip)
    res.status(201).json({ success: true, data: coupon })
  } catch (err) {
    next(err)
  }
}

export async function updateCouponController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const input = updateCouponSchema.parse(req.body)
    const coupon = await updateCoupon(storeId, req.params.id, input, userId, req.ip)
    res.json({ success: true, data: coupon })
  } catch (err) {
    next(err)
  }
}

export async function deleteCouponController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    await deleteCoupon(storeId, req.params.id, userId, req.ip)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
