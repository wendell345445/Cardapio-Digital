import { NextFunction, Request, Response } from 'express'

import { AppError } from '../../shared/middleware/error.middleware'

import {
  createStoreAdmin,
  createStoreAdminSchema,
  listStoreAdmins,
  removeStoreAdmin,
} from './store-admins.service'

// ─── TASK-0910: Store Admins Controller ──────────────────────────────────────

export async function listStoreAdminsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id: storeId } = req.params as { id: string }
    const result = await listStoreAdmins(storeId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function createStoreAdminController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id: storeId } = req.params as { id: string }
    const body = createStoreAdminSchema.safeParse(req.body)

    if (!body.success) {
      throw new AppError(body.error.errors[0]?.message ?? 'Dados inválidos', 400)
    }

    const admin = await createStoreAdmin(storeId, body.data)
    res.status(201).json({ success: true, data: admin })
  } catch (err) {
    next(err)
  }
}

export async function removeStoreAdminController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id: storeId, userId } = req.params as { id: string; userId: string }
    await removeStoreAdmin(storeId, userId)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
