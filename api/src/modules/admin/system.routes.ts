import { NextFunction, Request, Response, Router } from 'express'

import {
  authMiddleware,
  extractStoreId,
  requireRole,
  requireStore,
} from '../../shared/middleware/auth.middleware'
import { getGeocodingUsage } from '../menu/geocoding-usage.service'

const router = Router()

// Endpoints "system" — visíveis pra OWNER da loja. Hoje só tem o monitoramento
// da cota da Google Geocoding API; futuramente pode acomodar outros indicadores
// globais que o dono da operação precise ver.

router.use(authMiddleware, requireRole('OWNER'), extractStoreId, requireStore)

router.get(
  '/geocoding-usage',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const usage = await getGeocodingUsage()
      res.json({ success: true, data: usage })
    } catch (err) {
      next(err)
    }
  }
)

export default router
