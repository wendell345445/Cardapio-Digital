import { z } from 'zod'

// ─── TASK-090: Schema de Cupons ───────────────────────────────────────────────

// Um "cupom" cobre dois casos:
// 1. Clássico (code-based): cliente digita código no checkout → aplica desconto no total.
// 2. Promoção por produto: productId + promoPrice definem preço absoluto
//    mostrado no menu público entre startsAt e expiresAt. Código é auto-gerado
//    e não serve pra checkout.
export const createCouponSchema = z
  .object({
    code: z.string().min(3).max(30).toUpperCase().optional(),
    type: z.enum(['PERCENTAGE', 'FIXED']).optional(),
    value: z.number().positive().optional(),
    minOrder: z.number().nonnegative().optional().nullable(),
    maxUses: z.number().int().positive().optional().nullable(),
    startsAt: z.coerce.date().optional().nullable(),
    expiresAt: z.coerce.date().optional().nullable(),
    productId: z.string().uuid().optional().nullable(),
    promoPrice: z.number().positive().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.productId) {
      if (data.promoPrice == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'promoPrice obrigatório em promoção por produto',
          path: ['promoPrice'],
        })
      }
    } else {
      // Cupom clássico: code, type e value obrigatórios
      if (!data.code) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'code obrigatório em cupom sem produto',
          path: ['code'],
        })
      }
      if (!data.type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'type obrigatório em cupom sem produto',
          path: ['type'],
        })
      }
      if (data.value == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'value obrigatório em cupom sem produto',
          path: ['value'],
        })
      }
    }
  })

export const updateCouponSchema = z.object({
  code: z.string().min(3).max(30).toUpperCase().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  value: z.number().positive().optional(),
  minOrder: z.number().nonnegative().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
  startsAt: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  promoPrice: z.number().positive().optional().nullable(),
  isActive: z.boolean().optional(),
})

export const listCouponsSchema = z.object({
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  productId: z.string().uuid().optional(),
})

export type CreateCouponInput = z.infer<typeof createCouponSchema>
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>
export type ListCouponsInput = z.infer<typeof listCouponsSchema>
