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
  deleteDistanceController,
  geocodeAddressController,
  getDeliveryConfigController,
  listDistancesController,
  setStoreCoordinatesController,
  updateDistanceController,
} from './delivery.controller'

const router = Router()

router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

router.get('/', getDeliveryConfigController)
router.patch('/coordinates', setStoreCoordinatesController)
router.post('/geocode', geocodeAddressController)

router.get('/distances', listDistancesController)
router.post('/distances', createDistanceController)
router.patch('/distances/:id', updateDistanceController)
router.delete('/distances/:id', deleteDistanceController)

export default router
