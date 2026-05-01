import { z } from 'zod'

// v2.7: cliente envia accessToken (hash) em vez de tableNumber. Hash tem
// formato hex de 16 chars (vide generateAccessToken em tables.service.ts).
export const openTableSessionSchema = z.object({
  accessToken: z.string().regex(/^[a-f0-9]{16}$/i, 'Token inválido'),
  deviceName: z.string().trim().max(40).optional(),
})

export type OpenTableSessionInput = z.infer<typeof openTableSessionSchema>
