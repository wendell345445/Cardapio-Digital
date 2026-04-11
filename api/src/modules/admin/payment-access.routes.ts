import { Router } from 'express'

import {
  authMiddleware,
  extractStoreId,
  requireActiveStore,
  requireRole,
  requireStore,
} from '../../shared/middleware/auth.middleware'

import {
  addPaymentAccessController,
  listStoreClientsController,
  removePaymentAccessController,
} from './payment-access.controller'

// ─── TASK-054: Blacklist e Whitelist de Clientes ─────────────────────────────

const router = Router()

router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

router.get('/clients', listStoreClientsController)
router.post('/payment-access', addPaymentAccessController)
router.delete('/payment-access/:clientId', removePaymentAccessController)

export default router
