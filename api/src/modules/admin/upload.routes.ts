import { Router } from 'express'
import multer from 'multer'

import { authMiddleware, requireRole, extractStoreId, requireStore, requireActiveStore } from '../../shared/middleware/auth.middleware'

import { uploadImageController } from './upload.controller'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

const router = Router()

// POST /admin/upload
router.post(
  '/',
  authMiddleware,
  requireRole('ADMIN', 'OWNER'),
  extractStoreId,
  requireStore,
  requireActiveStore,
  upload.single('image'),
  uploadImageController
)

export default router
