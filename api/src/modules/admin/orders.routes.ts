import { Router } from 'express'

import {
  authMiddleware,
  extractStoreId,
  requireActiveStore,
  requireRole,
  requireStore,
} from '../../shared/middleware/auth.middleware'

import {
  assignMotoboyController,
  getOrderController,
  listOrdersController,
  sendWaitingPaymentController,
  updateOrderStatusController,
} from './orders.controller'

// ─── TASK-080: Rotas de Pedidos Admin ────────────────────────────────────────

const router = Router()

// All routes require auth + ADMIN/OWNER role + storeId
router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

router.get('/', listOrdersController)
router.get('/:id', getOrderController)
router.patch('/:id/status', updateOrderStatusController)
router.patch('/:id/motoboy', assignMotoboyController)
// TASK-123: Botão manual "Aguardando Pix"
router.patch('/:id/send-waiting-payment', sendWaitingPaymentController)

export default router
