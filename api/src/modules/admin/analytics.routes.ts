import { Router } from 'express'

import {
  authMiddleware,
  extractStoreId,
  requireActiveStore,
  requireRole,
  requireStore,
} from '../../shared/middleware/auth.middleware'

import {
  getClientDetailController,
  getClientRankingController,
  getPeakHoursController,
  getSalesController,
  getTopProductsController,
} from './analytics.controller'

// ─── TASK-093 / TASK-094: Rotas de Analytics e Ranking ───────────────────────

const router = Router()

router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

// Analytics
router.get('/sales', getSalesController)
router.get('/top-products', getTopProductsController)
router.get('/peak-hours', getPeakHoursController)

// Ranking de Clientes (TASK-094)
router.get('/clients/ranking', getClientRankingController)

// Detalhe do Cliente (A-008) — deve vir DEPOIS de /clients/ranking (mais específica primeiro)
router.get('/clients/:whatsapp', getClientDetailController)

export default router
