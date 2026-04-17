import { Router } from 'express'

import {
  authMiddleware,
  extractStoreId,
  requireActiveStore,
  requireRole,
  requireStore,
} from '../../shared/middleware/auth.middleware'

import {
  getClientRankingController,
  getPeakHoursController,
  getSalesController,
  getTopProductsController,
} from './analytics.controller'
import {
  getCustomerDetailController,
  getCustomerOrdersController,
  updateCustomerController,
} from './customers.controller'

// ─── TASK-093 / TASK-094: Rotas de Analytics e Ranking ───────────────────────

const router = Router()

router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

// Analytics
router.get('/sales', getSalesController)
router.get('/top-products', getTopProductsController)
router.get('/peak-hours', getPeakHoursController)

// Ranking de Clientes (TASK-094)
router.get('/clients/ranking', getClientRankingController)

// Detalhe + edição do perfil do cliente — deve vir DEPOIS de /clients/ranking
router.get('/clients/:whatsapp', getCustomerDetailController)
router.get('/clients/:whatsapp/orders', getCustomerOrdersController)
router.patch('/clients/:whatsapp', updateCustomerController)

export default router
