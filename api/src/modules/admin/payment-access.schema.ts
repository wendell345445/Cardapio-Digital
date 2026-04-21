import { z } from 'zod'

// ─── TASK-054: Blacklist e Whitelist de Clientes ─────────────────────────────

export const addPaymentAccessSchema = z.object({
  clientId: z.string().uuid(),
  type: z.enum(['BLACKLIST', 'WHITELIST']),
})

export type AddPaymentAccessInput = z.infer<typeof addPaymentAccessSchema>

// ─── ADR-0002: adicionar/classificar por WhatsApp (sem histórico prévio) ─────

export const addPaymentAccessByWhatsappSchema = z.object({
  whatsapp: z
    .string()
    .trim()
    .transform((s) => s.replace(/\D/g, ''))
    .pipe(z.string().min(10, 'WhatsApp deve ter pelo menos 10 dígitos').max(15)),
  name: z.string().trim().max(100).optional(),
  type: z.enum(['BLACKLIST', 'WHITELIST']),
})

export type AddPaymentAccessByWhatsappInput = z.infer<typeof addPaymentAccessByWhatsappSchema>
