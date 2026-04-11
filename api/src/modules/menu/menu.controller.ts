import { NextFunction, Request, Response } from 'express'

import { getMenu } from './menu.service'

// ─── TASK-060: Menu Público ───────────────────────────────────────────────────
// ─── TASK-122: slug vem de req.store (subdomain middleware) ──────────────────

export async function getMenuController(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.store!
    const result = await getMenu(slug)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
