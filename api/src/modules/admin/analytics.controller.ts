import { NextFunction, Request, Response } from 'express'

import { rankingQuerySchema, salesQuerySchema, topProductsQuerySchema } from './analytics.schema'
import {
  getClientDetail,
  getClientRanking,
  getPeakHours,
  getSalesSummary,
  getTopProducts,
} from './analytics.service'

// ─── TASK-093: Controllers de Analytics ──────────────────────────────────────

const SHORT_DATE_BRT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

export async function getSalesController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const query = salesQuerySchema.parse(req.query)
    const summary = await getSalesSummary(storeId, query)
    const series = summary.timeline.map((t) => ({
      label: SHORT_DATE_BRT.format(new Date(`${t.date}T12:00:00Z`)),
      revenue: t.revenue,
      orders: t.orders,
    }))
    res.json({
      success: true,
      data: {
        totalRevenue: summary.totalRevenue,
        totalOrders: summary.totalOrders,
        averageTicket: summary.averageTicket,
        cancelledCount: summary.cancelledCount,
        series,
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function getTopProductsController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const query = topProductsQuerySchema.parse(req.query)
    const items = await getTopProducts(storeId, query)
    const data = items.map((i) => ({
      productId: i.productId,
      productName: i.name,
      quantity: i.quantity,
      revenue: i.revenue,
    }))
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

// ─── A-008: Detalhe do cliente ───────────────────────────────────────────────

export async function getClientDetailController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { whatsapp } = req.params
    const data = await getClientDetail(storeId, whatsapp)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}
