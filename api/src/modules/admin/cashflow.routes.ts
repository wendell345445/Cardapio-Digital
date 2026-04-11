import { Router } from 'express'

import {
  authMiddleware,
  extractStoreId,
  requireActiveStore,
  requireRole,
  requireStore,
} from '../../shared/middleware/auth.middleware'

import {
  addAdjustmentController,
  closeCashFlowController,
  getCashFlowSummaryController,
  getCurrentCashFlowController,
  listCashFlowsController,
  openCashFlowController,
  updateInitialAmountController,
} from './cashflow.controller'

// ─── TASK-095: Rotas de Controle de Caixa ────────────────────────────────────

const router = Router()

router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

router.get('/', listCashFlowsController)
router.get('/current', getCurrentCashFlowController)
router.post('/', openCashFlowController)
router.get('/:id/summary', getCashFlowSummaryController)
router.patch('/:id/initial-amount', updateInitialAmountController)
router.post('/:id/adjustments', addAdjustmentController)
router.post('/:id/close', closeCashFlowController)

export default router
