import { Router } from 'express'

import {
  authMiddleware,
  extractStoreId,
  requireActiveStore,
  requireRole,
  requireStore,
} from '../../shared/middleware/auth.middleware'

import {
  createMotoboyController,
  deleteMotoboyController,
  listMotoboysController,
  setMotoboyAvailabilityController,
  updateMotoboyController,
} from './motoboys.controller'

const router = Router()

router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

router.get('/', listMotoboysController)
router.post('/', createMotoboyController)
router.patch('/:id/availability', setMotoboyAvailabilityController)
router.patch('/:id', updateMotoboyController)
router.delete('/:id', deleteMotoboyController)

export default router
