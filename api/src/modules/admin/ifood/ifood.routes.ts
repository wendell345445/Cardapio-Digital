import { Router } from 'express'

import {
  authMiddleware,
  extractStoreId,
  requireActiveStore,
  requireFeature,
  requireRole,
  requireStore,
} from '../../../shared/middleware/auth.middleware'

import {
  catalogImportController,
  catalogPreviewController,
  disconnectController,
  linkController,
  merchantsController,
  statusController,
} from './ifood.controller'

export const ifoodRouter = Router()

// Integração iFood é exclusiva do plano Premium (feature ifoodIntegration).
ifoodRouter.use(
  authMiddleware,
  requireRole('ADMIN', 'OWNER'),
  extractStoreId,
  requireStore,
  requireActiveStore,
  requireFeature('ifoodIntegration')
)

ifoodRouter.get('/status', statusController)
ifoodRouter.get('/merchants', merchantsController)
ifoodRouter.put('/merchant', linkController)
ifoodRouter.delete('/', disconnectController)
ifoodRouter.get('/catalog/preview', catalogPreviewController)
ifoodRouter.post('/catalog/import', catalogImportController)
