import { NextFunction, Request, Response, Router } from 'express'
import { z } from 'zod'

import { lookupCep } from '../menu/cep-lookup.service'

// CEP lookup público. Backend chama Google Geocoding (cota nossa) e cai em
// ViaCEP se Google não trouxer resultado utilizável. Centralizar no backend
// evita expor a chave da Google no browser.

export const cepRouter = Router()

const cepSchema = z.object({
  cep: z
    .string()
    .min(8)
    .max(10)
    .refine((v) => v.replace(/\D/g, '').length === 8, { message: 'CEP deve ter 8 dígitos' }),
})

cepRouter.post(
  '/lookup',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cep } = cepSchema.parse(req.body)
      const result = await lookupCep(cep)
      res.json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  }
)
