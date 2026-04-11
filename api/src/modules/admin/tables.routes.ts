import { Router } from 'express'

import {
  authMiddleware,
  requireRole,
  extractStoreId,
  requireStore,
  requireActiveStore,
} from '../../shared/middleware/auth.middleware'

import {
  listTablesController,
  createTableController,
  getQRCodeController,
  getQRCodePDFController,
  closeTableController,
  getComandaController,
  updateItemStatusController,
} from './tables.controller'

const router = Router()

router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

router.get('/', listTablesController)
router.post('/', createTableController)
router.get('/:id/qrcode', getQRCodeController)
router.get('/:id/qrcode/pdf', getQRCodePDFController)
router.get('/:id/comanda', getComandaController)
router.patch('/:id/close', closeTableController)
router.patch('/:tableId/items/:itemId/status', updateItemStatusController)

export default router
