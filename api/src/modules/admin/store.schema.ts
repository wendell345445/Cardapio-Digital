import { z } from 'zod'

// ─── TASK-050: Configurações da Loja ─────────────────────────────────────────

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve ser HEX no formato #RRGGBB')

// Aceita URL absoluta (Cloudinary) ou caminho relativo /uploads/... (fallback local).
// Mesma regra do products.schema — não usa .url() direto.
const logoSchema = z
  .string()
  .refine(
    (v) => /^https?:\/\//.test(v) || v.startsWith('/uploads/'),
    'Logo deve ser URL https:// ou caminho /uploads/...'
  )

export const updateStoreSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  logo: logoSchema.optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  primaryColor: hexColorSchema.optional().nullable(),
  secondaryColor: hexColorSchema.optional().nullable(),
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
  manualOpen: z.boolean(),
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
  allowDelivery: z.boolean().optional(),
  allowTable: z.boolean().optional(),
  // Granularidade dentro de Entrega: distância (Haversine) e/ou bairros cadastrados.
  // allowDelivery=false desliga ambas no checkout independente desses flags.
  deliveryByDistanceEnabled: z.boolean().optional(),
  deliveryByNeighborhoodEnabled: z.boolean().optional(),
  autoConfirmOrders: z.boolean().optional(),
  serviceChargePercent: z.number().min(0).max(100).nullable().optional(),
})

export type UpdateStoreInput = z.infer<typeof updateStoreSchema>
export type BusinessHourInput = z.infer<typeof businessHourSchema>
export type UpdateBusinessHoursInput = z.infer<typeof updateBusinessHoursSchema>
export type UpdateStoreStatusInput = z.infer<typeof updateStoreStatusSchema>
export type UpdateWhatsappInput = z.infer<typeof updateWhatsappSchema>
export type UpdatePixInput = z.infer<typeof updatePixSchema>
export type UpdatePaymentSettingsInput = z.infer<typeof updatePaymentSettingsSchema>
