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
  getOrderReceiptController,
  listOrdersController,
  updateOrderAddressController,
  updateOrderStatusController,
} from './orders.controller'

// ─── TASK-080: Rotas de Pedidos Admin ────────────────────────────────────────

const router = Router()

// All routes require auth + ADMIN/OWNER role + storeId
router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

router.get('/', listOrdersController)
router.get('/:id', getOrderController)
// TASK-084/A-050: Recibo para impressão manual
router.get('/:id/receipt', getOrderReceiptController)
router.patch('/:id/status', updateOrderStatusController)
router.patch('/:id/address', updateOrderAddressController)
router.patch('/:id/motoboy', assignMotoboyController)

export default router
