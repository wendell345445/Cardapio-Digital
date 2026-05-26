import { Request, Response, Router } from 'express'

import {
  authMiddleware,
  extractStoreId,
  requireRole,
  requireStore,
} from '../../shared/middleware/auth.middleware'

const router = Router()

// Endpoints "system" — visíveis pra OWNER da loja. Tinha cota da Google
// Geocoding API; geo agora é self-host (Photon/Nominatim/OSRM) e não tem cota.
// Mantemos o endpoint pra não quebrar o admin frontend antigo — sempre retorna
// zerado/deprecated. Remover quando o frontend deixar de chamar.

router.use(authMiddleware, requireRole('OWNER'), extractStoreId, requireStore)

router.get('/geocoding-usage', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      deprecated: true,
      used: 0,
      quota: 0,
      message: 'Geocoding migrado pra OSM self-host (sem cota).',
    },
  })
})

export default router
