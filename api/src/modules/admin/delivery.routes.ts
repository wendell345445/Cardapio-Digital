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

router.get('/distances', listDistancesController)
router.post('/distances', createDistanceController)
router.patch('/distances/:id', updateDistanceController)
router.delete('/distances/:id', deleteDistanceController)

router.get('/neighborhoods', listNeighborhoodsController)
router.post('/neighborhoods', createNeighborhoodController)
router.patch('/neighborhoods/:id', updateNeighborhoodController)
router.delete('/neighborhoods/:id', deleteNeighborhoodController)

export default router
