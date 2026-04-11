import { Router } from 'express'

import {
  authMiddleware,
  requireRole,
  extractStoreId,
  requireStore,
  requireActiveStore,
} from '../../shared/middleware/auth.middleware'

import {
  getStoreController,
  updateStoreController,
  getBusinessHoursController,
  updateBusinessHoursController,
  updateStoreStatusController,
  updateWhatsappController,
  updatePixController,
  updatePaymentSettingsController,
} from './store.controller'
import {
  getWhatsAppMessagesController,
  updateWhatsAppMessageController,
  resetWhatsAppMessageController,
} from './whatsapp-messages.controller'

// ─── TASK-050 / 051 / 052: Configurações da Loja ─────────────────────────────

const router = Router()

// Auth chain SEM `requireActiveStore` — permite leitura mesmo com loja suspensa,
// pra o frontend conseguir buscar o status e renderizar o guard de suspensão.
router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore)

// ─── Rotas de leitura — acessíveis MESMO com loja SUSPENDED ──────────────────
// O frontend usa `GET /admin/store` pra detectar status e redirecionar pra billing.
router.get('/', getStoreController)
router.get('/hours', getBusinessHoursController)
router.get('/whatsapp-messages', getWhatsAppMessagesController)

// ─── Rotas de escrita — bloqueadas quando loja SUSPENDED ─────────────────────
router.use(requireActiveStore)

// TASK-050
router.patch('/', updateStoreController)
router.put('/hours', updateBusinessHoursController)
router.patch('/status', updateStoreStatusController)

// TASK-051
router.patch('/whatsapp', updateWhatsappController)
router.patch('/pix', updatePixController)

// TASK-052
router.patch('/payment-settings', updatePaymentSettingsController)

// TASK-097 + TASK-116: WhatsApp Message Templates
router.put('/whatsapp-messages/:eventType', updateWhatsAppMessageController)
router.delete('/whatsapp-messages/:eventType', resetWhatsAppMessageController)

export default router
