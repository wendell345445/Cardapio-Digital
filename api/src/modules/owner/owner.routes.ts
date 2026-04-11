import { Router } from 'express'

import { authMiddleware, requireRole } from '../../shared/middleware/auth.middleware'

import {
  cancelStoreController,
  createStoreController,
  endTrialNowController,
  getAuditLogsController,
  getStoreController,
  listStoresController,
  updateStoreController,
  updateStorePlanController,
} from './owner.controller'
import {
  createStoreAdminController,
  listStoreAdminsController,
  removeStoreAdminController,
} from './store-admins.controller'

export const ownerRouter = Router()

ownerRouter.use(authMiddleware, requireRole('OWNER'))

ownerRouter.get('/stores', listStoresController)
ownerRouter.post('/stores', createStoreController)
ownerRouter.get('/stores/:id', getStoreController)
ownerRouter.patch('/stores/:id', updateStoreController)
ownerRouter.delete('/stores/:id', cancelStoreController)
ownerRouter.patch('/stores/:id/plan', updateStorePlanController)
ownerRouter.get('/stores/:id/audit-logs', getAuditLogsController)

// TASK-0910: Admins adicionais
ownerRouter.get('/stores/:id/admins', listStoreAdminsController)
ownerRouter.post('/stores/:id/admins', createStoreAdminController)
ownerRouter.delete('/stores/:id/admins/:userId', removeStoreAdminController)

// ─── OWNER TOOL ───────────────────────────────────────────────────────────────
// POST /api/v1/owner/stores/:id/dev/end-trial
//
// Encerra o trial de uma loja imediatamente e enfileira o sweep de suspensão.
// Disponível em todos os ambientes (dev/staging/prod) — é uma ação operacional
// do Owner pra validar o fluxo ou agir sobre uma loja específica.
//
// AUTORIZAÇÃO: herda automaticamente do `ownerRouter.use(authMiddleware, requireRole('OWNER'))`
// no topo — só aceita request com JWT válido cujo role seja OWNER. Mesmo padrão
// de todas as outras rotas do módulo (createStore, cancelStore, etc).
ownerRouter.post('/stores/:id/dev/end-trial', endTrialNowController)
