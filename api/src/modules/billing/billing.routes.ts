import { Router } from 'express'

import { authMiddleware, extractStoreId, requireRole, requireStore } from '../../shared/middleware/auth.middleware'

import { createPortalSessionController } from './billing.controller'

export const billingRouter = Router()

// Todas as rotas de billing exigem admin autenticado com loja associada
billingRouter.use(authMiddleware, extractStoreId, requireRole('ADMIN'), requireStore)

billingRouter.post('/portal-session', createPortalSessionController)
