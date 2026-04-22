import { Router } from 'express'
import rateLimit from 'express-rate-limit'

import { authMiddleware, requireRole, extractStoreId, requireStore, requireActiveStore } from '../../shared/middleware/auth.middleware'

import { disconnectController, getHealthController, getQrCodeController } from './whatsapp.controller'

export const whatsappRouter = Router()

whatsappRouter.use(authMiddleware, requireRole('ADMIN'), extractStoreId, requireStore, requireActiveStore)

// Rate limit específico pra DESCONECTAR WhatsApp: 1 req / 3s por storeId.
// Aplicado SÓ no DELETE (ação destrutiva). O GET /qrcode é polling do frontend
// (precisa ser frequente pra detectar mudança de QR / connection.update) — limitar
// quebraria a UI. A idempotência em connectWhatsApp() já protege contra spam de GET.
// keyGenerator por storeId (tenant), não por IP — previne cross-tenant lockout.
const disconnectRateLimiter = rateLimit({
  windowMs: 3_000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.tenant?.storeId ?? req.ip ?? 'unknown',
  message: {
    success: false,
    error: 'Aguarde alguns segundos antes de tentar novamente',
    code: 'WHATSAPP_LIFECYCLE_RATE_LIMIT',
  },
})

whatsappRouter.get('/qrcode', getQrCodeController)
whatsappRouter.delete('/', disconnectRateLimiter, disconnectController)
whatsappRouter.get('/health', getHealthController)
