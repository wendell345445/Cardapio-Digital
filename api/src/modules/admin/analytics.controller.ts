import { NextFunction, Request, Response } from 'express'

import { rankingQuerySchema, salesQuerySchema, topProductsQuerySchema } from './analytics.schema'
import {
  getClientRanking,
  getPeakHours,
  getSalesSummary,
  getTopProducts,
} from './analytics.service'

// ─── TASK-093: Controllers de Analytics ──────────────────────────────────────

export async function getSalesController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const query = salesQuerySchema.parse(req.query)
    const data = await getSalesSummary(storeId, query)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function getTopProductsController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const query = topProductsQuerySchema.parse(req.query)
    const data = await getTopProducts(storeId, query)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function getPeakHoursController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const data = await getPeakHours(storeId)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

// ─── TASK-094: Controller de Ranking de Clientes ─────────────────────────────

export async function getClientRankingController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const query = rankingQuerySchema.parse(req.query)
    const data = await getClientRanking(storeId, query)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}
