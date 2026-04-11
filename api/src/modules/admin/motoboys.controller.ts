import { NextFunction, Request, Response } from 'express'

import type { JwtPayload } from '../../shared/middleware/auth.middleware'

import { createMotoboySchema } from './motoboys.schema'
import { createMotoboy, deleteMotoboy, listMotoboys } from './motoboys.service'

function getUser(req: Request): JwtPayload {
  return req.user as unknown as JwtPayload
}

export async function listMotoboysController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const result = await listMotoboys(storeId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function createMotoboyController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const data = createMotoboySchema.parse(req.body)
    const result = await createMotoboy(storeId, data, userId, req.ip)
    res.status(201).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function deleteMotoboyController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { id } = req.params
    await deleteMotoboy(storeId, id, userId, req.ip)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
