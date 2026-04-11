import { z } from 'zod'

// ─── TASK-054: Blacklist e Whitelist de Clientes ─────────────────────────────

export const addPaymentAccessSchema = z.object({
  clientId: z.string().uuid(),
  type: z.enum(['BLACKLIST', 'WHITELIST']),
})

export type AddPaymentAccessInput = z.infer<typeof addPaymentAccessSchema>
