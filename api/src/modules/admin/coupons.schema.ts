import { z } from 'zod'

// ─── TASK-090: Schema de Cupons ───────────────────────────────────────────────

export const createCouponSchema = z.object({
  code: z.string().min(3).max(30).toUpperCase(),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.number().positive(),
  minOrder: z.number().nonnegative().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
})

export const updateCouponSchema = createCouponSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export const listCouponsSchema = z.object({
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
})

export type CreateCouponInput = z.infer<typeof createCouponSchema>
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>
export type ListCouponsInput = z.infer<typeof listCouponsSchema>
