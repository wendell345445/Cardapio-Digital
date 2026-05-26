import { NextFunction, Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'

import { AppError } from '../../shared/middleware/error.middleware'
import { publicTenantMiddleware } from '../../shared/middleware/tenant.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { validateCoupon } from '../admin/coupons.service'
import { calculateDeliverySchema, geocodeAddressSchema } from '../admin/delivery.schema'
import { calculateDeliveryFee, listAvailableNeighborhoods } from '../admin/delivery.service'

import * as geoService from './geo/geo.service'
import { getMenuController } from './menu.controller'
import { createOrderController, listOrdersBySessionController } from './orders.controller'
import { getCustomerComandaController, requestCheckController } from './comanda.controller'
import {
  getTableByTokenController,
  getTableSessionController,
  openTableSessionController,
} from './table-session.controller'
import { getOrderTrackingController } from './tracking.controller'

// ─── TASK-060: Menu Público ───────────────────────────────────────────────────
// ─── TASK-065: Pedidos Públicos ───────────────────────────────────────────────
// ─── TASK-066: Acompanhamento do Pedido (magic link) ─────────────────────────
// ─── TASK-090: Validação de Cupom Público ────────────────────────────────────
// ─── TASK-091: Cálculo de Taxa de Entrega Público ────────────────────────────
// ─── TASK-122: Subdomain routing — slug vem do hostname, não da URL ──────────

export const menuRouter = Router()

menuRouter.use(publicTenantMiddleware)

menuRouter.get('/', getMenuController)
menuRouter.post('/orders', createOrderController)
menuRouter.get('/orders/by-session/:sessionId', listOrdersBySessionController)
menuRouter.get('/pedido/:token', getOrderTrackingController)

// Sessão de mesa: abre/entra na sessão da mesa via QR code (substitui ?mesa=N).
menuRouter.post('/table-session', openTableSessionController)
menuRouter.get('/table-session/:token', getTableSessionController)
// v2.7: resolve hash do QR (URL /mesa/:accessToken) → info pública da mesa.
menuRouter.get('/table-by-token/:accessToken', getTableByTokenController)

// ─── A-056: Comanda pública do cliente ──────────────────────────────────────
menuRouter.get('/comanda', getCustomerComandaController)
menuRouter.post('/comanda/check', requestCheckController)

// POST /menu/coupon/validate
menuRouter.post(
  '/coupon/validate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const storeId = req.store!.id
      const { code, subtotal } = z
        .object({ code: z.string().min(1), subtotal: z.number().nonnegative().optional() })
        .parse(req.body)

      const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } })
      if (!store) throw new AppError('Loja não encontrada', 404)

      const result = await validateCoupon(store.id, code, subtotal)
      res.json({ success: true, data: { discount: result.discount, coupon: result.coupon } })
    } catch (err) {
      next(err)
    }
  }
)

// POST /menu/delivery/geocode
menuRouter.post(
  '/delivery/geocode',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = geocodeAddressSchema.parse(req.body)
      const result = await geoService.geocode(input)
      if (!result) throw new AppError('Endereço não encontrado', 422)
      res.json({
        success: true,
        data: {
          latitude: result.latitude,
          longitude: result.longitude,
          displayName: result.displayName,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

// POST /menu/delivery/calculate
menuRouter.post(
  '/delivery/calculate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const storeId = req.store!.id
      const input = calculateDeliverySchema.parse(req.body)
      const result = await calculateDeliveryFee(storeId, input)
      res.json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  }
)

// ─── Geo (OSM) — proxy do browser pros serviços self-hosted via api (mTLS) ───
// O browser NÃO apresenta cert de cliente; quem mantém o mTLS é a api. Estes
// 3 endpoints são tenant-scoped (passam pelo publicTenantMiddleware lá em
// cima).

// GET /menu/geo/autocomplete?q=...&lat=...&lon=...
menuRouter.get(
  '/geo/autocomplete',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q, lat, lon, limit } = z
        .object({
          q: z.string().min(3),
          lat: z.coerce.number().optional(),
          lon: z.coerce.number().optional(),
          limit: z.coerce.number().int().min(1).max(10).optional(),
        })
        .parse(req.query)
      const data = await geoService.autocomplete(q, { lat, lon, limit })
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  }
)

// POST /menu/geo/reverse { lat, lon }
menuRouter.post(
  '/geo/reverse',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lat, lon } = z
        .object({
          lat: z.number().min(-90).max(90),
          lon: z.number().min(-180).max(180),
        })
        .parse(req.body)
      const data = await geoService.reverse(lat, lon)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  }
)

// POST /menu/geo/route { from:{lat,lon}, to:{lat,lon} }
// Usado pelo cardápio público / PDV pra exibir "distância A → B" no preview
// do frete antes de finalizar o pedido.
menuRouter.post(
  '/geo/route',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const point = z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      const { from, to } = z.object({ from: point, to: point }).parse(req.body)
      const data = await geoService.route(from, to)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  }
)

// GET /menu/delivery/neighborhoods — bairros disponíveis para o select do checkout.
menuRouter.get(
  '/delivery/neighborhoods',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const storeId = req.store!.id
      const data = await listAvailableNeighborhoods(storeId)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  }
)
