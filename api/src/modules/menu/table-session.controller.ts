import { NextFunction, Request, Response } from 'express'

import { openTableSessionSchema } from './table-session.schema'
import { getSession, getTableByAccessToken, openOrJoinSession } from './table-session.service'

export async function openTableSessionController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const storeId = req.store!.id
    const { accessToken } = openTableSessionSchema.parse(req.body)
    const data = await openOrJoinSession(storeId, accessToken)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function getTableSessionController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const storeId = req.store!.id
    const token = req.params.token
    const data = await getSession(storeId, token)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

// v2.7: resolve hash do QR → info da mesa (sem abrir sessão).
export async function getTableByTokenController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const storeId = req.store!.id
    const data = await getTableByAccessToken(storeId, req.params.accessToken)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}
