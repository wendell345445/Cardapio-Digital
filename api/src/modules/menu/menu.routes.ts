import { NextFunction, Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'

import { AppError } from '../../shared/middleware/error.middleware'
import { publicTenantMiddleware } from '../../shared/middleware/tenant.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { validateCoupon } from '../admin/coupons.service'
import { calculateDeliverySchema, geocodeAddressSchema } from '../admin/delivery.schema'
import { calculateDeliveryFee } from '../admin/delivery.service'

import { geocodeAddress } from './geocoding.service'
import { getMenuController } from './menu.controller'
import { createOrderController, listOrdersBySessionController } from './orders.controller'
import { getCustomerComandaController, requestCheckController } from './comanda.controller'
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
      const result = await geocodeAddress(input)
      res.json({ success: true, data: result })
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
