import { Router } from 'express'

import { authMiddleware, extractStoreId, requireRole, requireStore } from '../../shared/middleware/auth.middleware'

import {
  changePlanController,
  changePlanPreviewController,
  createCheckoutSessionController,
  createPixAutoController,
  getPixAutoStatusController,
} from './billing.controller'

export const billingRouter = Router()

// Todas as rotas de billing exigem admin autenticado com loja associada
billingRouter.use(authMiddleware, extractStoreId, requireRole('ADMIN'), requireStore)

// Cartão (Checkout hospedado) e PIX Automático (autorização in-app).
billingRouter.post('/checkout-session', createCheckoutSessionController)
billingRouter.post('/pix-auto', createPixAutoController)
billingRouter.get('/pix-auto/status', getPixAutoStatusController)

// Troca de plano (upgrade com pro-rata / downgrade agendado)
billingRouter.get('/change-plan/preview', changePlanPreviewController)
billingRouter.post('/change-plan', changePlanController)
