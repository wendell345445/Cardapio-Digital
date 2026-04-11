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
} from './motoboys.controller'

const router = Router()

router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

router.get('/', listMotoboysController)
router.post('/', createMotoboyController)
router.delete('/:id', deleteMotoboyController)

export default router
