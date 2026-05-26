import { Router } from 'express'

import { authenticatedRateLimiter } from './shared/middleware/rateLimit.middleware'
import { authRouter } from './modules/auth/auth.routes'
import { billingRouter } from './modules/billing/billing.routes'
import { ownerRouter } from './modules/owner/owner.routes'
import { webhookRouter } from './modules/webhooks/webhook.routes'
import { adminRouter } from './modules/admin/admin.routes'
import { menuRouter } from './modules/menu/menu.routes'
import motoboyRouter from './modules/motoboy/motoboy.routes'

export const router = Router()

router.use('/auth', authRouter)
router.use('/owner', authenticatedRateLimiter, ownerRouter)
router.use('/webhooks', webhookRouter)
router.use('/admin', authenticatedRateLimiter, adminRouter)
router.use('/menu', menuRouter)
router.use('/motoboy', authenticatedRateLimiter, motoboyRouter)
router.use('/billing', authenticatedRateLimiter, billingRouter)
