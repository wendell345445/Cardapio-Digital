import { Router } from 'express'
import multer from 'multer'

import {
  authMiddleware,
  requireRole,
  extractStoreId,
  requireStore,
  requireActiveStore,
} from '../../shared/middleware/auth.middleware'

import {
  listProductsController,
  getProductController,
  createProductController,
  updateProductController,
  deleteProductController,
  duplicateProductController,
  downloadTemplateController,
  importProductsController,
} from './products.controller'

// ─── TASK-041: Produtos CRUD Individual ──────────────────────────────────────

const router = Router()

router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

// ─── TASK-043: Importação em Massa CSV/XLSX ───────────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })
router.get('/template', downloadTemplateController)
router.post('/import', upload.single('file'), importProductsController)  // reauth required (TODO)

router.get('/', listProductsController)
router.get('/:id', getProductController)
router.post('/', createProductController)       // reauth required (TODO)
router.post('/:id/duplicate', duplicateProductController)
router.patch('/:id', updateProductController)   // reauth required (TODO)
router.delete('/:id', deleteProductController)  // reauth required (TODO)

export default router
