import { z } from 'zod'

import { isReservedSlug } from '../../shared/utils/reserved-slugs'

export const listStoresSchema = z.object({
  status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']).optional(),
})

export const createStoreSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug deve ser alfanumérico com hífens (ex: minha-loja)')
    // RN-001C: bloqueia slugs reservados pelo sistema (api, www, admin, …)
    // porque colidiriam com subdomínios de infra — ver shared/utils/reserved-slugs.ts
    .refine((s) => !isReservedSlug(s), {
      message: 'Este slug é reservado pelo sistema (ex: api, www, admin). Escolha outro.',
    }),
  plan: z.enum(['PROFESSIONAL', 'PREMIUM']),
  adminEmail: z.string().email(),
  whatsapp: z
    .string()
    .regex(/^\d{11}$/, 'WhatsApp deve ter 11 dígitos (DDD + número)'),
  adminName: z.string().min(2).max(100).optional(),
  whatsappMode: z.enum(['WHATSAPP', 'WHATSAPP_AI']).optional(),
}).refine(
  (data) => !(data.whatsappMode === 'WHATSAPP_AI' && data.plan !== 'PREMIUM'),
  { message: 'WhatsApp com IA requer o plano PREMIUM', path: ['whatsappMode'] }
)

export const updateStoreSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']).optional(),
  whatsappMode: z.enum(['WHATSAPP', 'WHATSAPP_AI']).optional(),
})

export const updateStorePlanSchema = z.object({
  plan: z.enum(['PROFESSIONAL', 'PREMIUM']),
})

export const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export type CreateStoreInput = z.infer<typeof createStoreSchema>
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>
export type UpdateStorePlanInput = z.infer<typeof updateStorePlanSchema>
export type AuditLogsQueryInput = z.infer<typeof auditLogsQuerySchema>
