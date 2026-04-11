import { z } from 'zod'

// ─── TASK-050: Configurações da Loja ─────────────────────────────────────────

export const updateStoreSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  logo: z.string().url().optional().nullable(),
  address: z.string().max(300).optional().nullable(),
})

export const businessHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato inválido, use HH:mm')
    .optional()
    .nullable(),
  closeTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato inválido, use HH:mm')
    .optional()
    .nullable(),
  isClosed: z.boolean().default(false),
})

export const updateBusinessHoursSchema = z.object({
  hours: z
    .array(businessHourSchema)
    .length(7, 'Informe exatamente 7 dias (0=Dom a 6=Sáb)'),
})

export const updateStoreStatusSchema = z.object({
  manualOpen: z.boolean().nullable(),
})

// ─── TASK-051: WhatsApp e Pix (reauth obrigatória) ───────────────────────────

export const updateWhatsappSchema = z.object({
  phone: z
    .string()
    .regex(/^\d{10,13}$/, 'Número inválido (10-13 dígitos, sem +)'),
  password: z.string().min(1, 'Senha obrigatória para confirmar'),
})

export const updatePixSchema = z.object({
  pixKey: z.string().min(1).max(150),
  pixKeyType: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP']),
  password: z.string().min(1, 'Senha obrigatória para confirmar'),
})

// ─── TASK-052: Formas de Pagamento e Retirada ─────────────────────────────────

export const updatePaymentSettingsSchema = z.object({
  allowCashOnDelivery: z.boolean().optional(),
  allowPix: z.boolean().optional(),
  allowPickup: z.boolean().optional(),
  serviceChargePercent: z.number().min(0).max(100).nullable().optional(),
})

export type UpdateStoreInput = z.infer<typeof updateStoreSchema>
export type BusinessHourInput = z.infer<typeof businessHourSchema>
export type UpdateBusinessHoursInput = z.infer<typeof updateBusinessHoursSchema>
export type UpdateStoreStatusInput = z.infer<typeof updateStoreStatusSchema>
export type UpdateWhatsappInput = z.infer<typeof updateWhatsappSchema>
export type UpdatePixInput = z.infer<typeof updatePixSchema>
export type UpdatePaymentSettingsInput = z.infer<typeof updatePaymentSettingsSchema>
