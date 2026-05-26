import { NextFunction, Request, Response, Router } from 'express'
import { z } from 'zod'

import {
  authMiddleware,
  extractStoreId,
  requireActiveStore,
  requireRole,
  requireStore,
} from '../../shared/middleware/auth.middleware'
import * as geoService from '../menu/geo/geo.service'

import {
  calculateDeliveryAdminController,
  createDistanceController,
  createNeighborhoodController,
  deleteDistanceController,
  deleteNeighborhoodController,
  geocodeAddressController,
  getDeliveryConfigController,
  listDistancesController,
  listNeighborhoodsController,
  setStoreCoordinatesController,
  updateDeliverySettingsController,
  updateDistanceController,
  updateNeighborhoodController,
} from './delivery.controller'

const router = Router()

router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

router.get('/', getDeliveryConfigController)
router.patch('/coordinates', setStoreCoordinatesController)
router.patch('/settings', updateDeliverySettingsController)
router.post('/geocode', geocodeAddressController)
// PDV: calcula frete ao vivo no drawer de novo pedido (mesma lógica do checkout).
router.post('/calculate', calculateDeliveryAdminController)

// ─── Geo (OSM) — proxy admin pros serviços self-hosted via mTLS ──────────────
// PDV + admin de delivery + CustomerEditModal usam estes endpoints. Lógica
// idêntica aos /menu/geo/* públicos; replicados aqui pra ficar atrás da auth
// admin (sem expor pra anônimos).
router.get(
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

router.post('/geo/reverse', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lon } = z
      .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
      .parse(req.body)
    const data = await geoService.reverse(lat, lon)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

router.post('/geo/route', async (req: Request, res: Response, next: NextFunction) => {
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
})

router.get('/distances', listDistancesController)
router.post('/distances', createDistanceController)
router.patch('/distances/:id', updateDistanceController)
router.delete('/distances/:id', deleteDistanceController)

router.get('/neighborhoods', listNeighborhoodsController)
router.post('/neighborhoods', createNeighborhoodController)
router.patch('/neighborhoods/:id', updateNeighborhoodController)
router.delete('/neighborhoods/:id', deleteNeighborhoodController)

export default router
