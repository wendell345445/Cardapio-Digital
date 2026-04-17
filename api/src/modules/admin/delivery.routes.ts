import { Router } from 'express'

import {
  authMiddleware,
  extractStoreId,
  requireActiveStore,
  requireRole,
  requireStore,
} from '../../shared/middleware/auth.middleware'

import {
  createDistanceController,
  createNeighborhoodController,
  deleteDistanceController,
  deleteNeighborhoodController,
  getDeliveryConfigController,
  listDistancesController,
  listNeighborhoodsController,
  setDeliveryModeController,
  setStoreCoordinatesController,
  updateDistanceController,
  updateNeighborhoodController,
} from './delivery.controller'

// ─── TASK-091: Rotas de Área de Entrega Admin ────────────────────────────────

const router = Router()

router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

router.get('/', getDeliveryConfigController)
router.patch('/mode', setDeliveryModeController)
router.patch('/coordinates', setStoreCoordinatesController)

router.get('/neighborhoods', listNeighborhoodsController)
router.post('/neighborhoods', createNeighborhoodController)
router.patch('/neighborhoods/:id', updateNeighborhoodController)
router.delete('/neighborhoods/:id', deleteNeighborhoodController)

router.get('/distances', listDistancesController)
router.post('/distances', createDistanceController)
router.patch('/distances/:id', updateDistanceController)
router.delete('/distances/:id', deleteDistanceController)

export default router
