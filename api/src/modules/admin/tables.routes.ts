import { Router } from 'express'

import {
  authMiddleware,
  requireRole,
  extractStoreId,
  requireStore,
  requireActiveStore,
} from '../../shared/middleware/auth.middleware'

import {
  closeTableController,
  confirmTablePaymentController,
  createTableController,
  getAllQRCodesPDFController,
  getComandaController,
  getQRCodeController,
  getQRCodePDFController,
  listClosedSessionsController,
  listTablesController,
  setTablesCountController,
  updateItemStatusController,
} from './tables.controller'

const router = Router()

router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

router.get('/', listTablesController)
router.post('/', createTableController)
// Rotas específicas devem vir antes das genéricas com :id pra evitar shadow.
router.put('/count', setTablesCountController)
router.get('/qrcode/pdf-all', getAllQRCodesPDFController)
router.get('/sessions/history', listClosedSessionsController)
router.get('/:id/qrcode', getQRCodeController)
router.get('/:id/qrcode/pdf', getQRCodePDFController)
router.get('/:id/comanda', getComandaController)
router.patch('/:id/close', closeTableController)
router.post('/:id/payment', confirmTablePaymentController)
router.patch('/:tableId/items/:itemId/status', updateItemStatusController)

export default router
