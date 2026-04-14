import { NextFunction, Request, Response } from 'express'

import { updateCustomerSchema } from './customers.schema'
import { getCustomerDetail, upsertCustomer } from './customers.service'

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
