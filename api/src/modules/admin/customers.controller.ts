import { NextFunction, Request, Response } from 'express'

import { updateCustomerSchema } from './customers.schema'
import { getCustomerDetail, getCustomerOrders, upsertCustomer } from './customers.service'

export async function getCustomerDetailController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const { whatsapp } = req.params
    const data = await getCustomerDetail(storeId, whatsapp)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function getCustomerOrdersController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const { whatsapp } = req.params
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10))
    const data = await getCustomerOrders(storeId, whatsapp, page, limit)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function updateCustomerController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const { whatsapp } = req.params
    const input = updateCustomerSchema.parse(req.body)
    const data = await upsertCustomer(storeId, whatsapp, input)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}
