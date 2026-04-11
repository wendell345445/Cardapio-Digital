import { Router } from 'express'

import {
  authMiddleware,
  extractStoreId,
  requireMotoboy,
} from '../../shared/middleware/auth.middleware'

import { listOrdersController, markDeliveredController } from './motoboy.controller'

// ─── TASK-083: Rotas do Motoboy ───────────────────────────────────────────────

const router = Router({ mergeParams: true })

// All routes require auth + MOTOBOY role + storeId
router.use(authMiddleware, extractStoreId, requireMotoboy)

router.get('/orders', listOrdersController)                    // GET  /:slug/motoboy/orders?tab=active|history
router.patch('/orders/:id/deliver', markDeliveredController)  // PATCH /:slug/motoboy/orders/:id/deliver

export default router
