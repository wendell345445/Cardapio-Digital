import { Router } from 'express'

import {
  authMiddleware,
  extractStoreId,
  requireActiveStore,
  requireRole,
  requireStore,
} from '../../shared/middleware/auth.middleware'

import {
  createCouponController,
  deleteCouponController,
  getCouponController,
  listCouponsController,
  updateCouponController,
} from './coupons.controller'

// ─── TASK-090: Rotas de Cupons Admin ─────────────────────────────────────────

const router = Router()

router.use(authMiddleware, requireRole('ADMIN', 'OWNER'), extractStoreId, requireStore, requireActiveStore)

router.get('/', listCouponsController)
router.get('/:id', getCouponController)
// create/update/delete requerem reauth (validação de senha sensível)
router.post('/', createCouponController)
router.patch('/:id', updateCouponController)
router.delete('/:id', deleteCouponController)

export default router
