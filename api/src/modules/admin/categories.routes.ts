import { Router } from 'express'

import {
  authMiddleware,
  requireRole,
  extractStoreId,
  requireStore,
  requireActiveStore,
} from '../../shared/middleware/auth.middleware'

import {
  listCategoriesController,
  createCategoryController,
  updateCategoryController,
  deleteCategoryController,
} from './categories.controller'

const router = Router()

router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

router.get('/', listCategoriesController)
router.post('/', createCategoryController)
router.patch('/:id', updateCategoryController)
router.delete('/:id', deleteCategoryController)

export default router
