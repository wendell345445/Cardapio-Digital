import { Router } from 'express'

import { authMiddleware, requireRole, extractStoreId, requireStore, requireActiveStore } from '../../shared/middleware/auth.middleware'

import { getQrCodeController, disconnectController } from './whatsapp.controller'

export const whatsappRouter = Router()

whatsappRouter.use(authMiddleware, requireRole('ADMIN'), extractStoreId, requireStore, requireActiveStore)

whatsappRouter.get('/qrcode', getQrCodeController)
whatsappRouter.delete('/', disconnectController)
