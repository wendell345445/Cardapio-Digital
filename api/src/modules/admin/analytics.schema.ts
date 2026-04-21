import { z } from 'zod'

// ─── TASK-093: Schema de Analytics ───────────────────────────────────────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')

// Quando period='range', from e to são obrigatórios e from <= to.
// Quando period ∈ {day, week, month}, from/to são ignorados.
function refineRange(
  data: { period: string; from?: string; to?: string },
  ctx: z.RefinementCtx
) {
  if (data.period !== 'range') return
  if (!data.from || !data.to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'from e to são obrigatórios quando period=range',
      path: ['from'],
    })
    return
  }
  if (data.from > data.to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'from deve ser menor ou igual a to',
      path: ['from'],
    })
  }
}

export const salesQuerySchema = z
  .object({
    period: z.enum(['day', 'week', 'month', 'range']).default('week'),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .superRefine(refineRange)

export const topProductsQuerySchema = z
  .object({
    period: z.enum(['day', 'week', 'month', 'range']).default('week'),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .superRefine(refineRange)

export const peakHoursQuerySchema = z
  .object({
    period: z.enum(['day', 'week', 'month', 'range']).default('month'),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .superRefine(refineRange)

export const paymentBreakdownQuerySchema = z
  .object({
    period: z.enum(['day', 'week', 'month', 'range']).default('week'),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .superRefine(refineRange)

export const rankingQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
})

export type SalesQuery = z.infer<typeof salesQuerySchema>
export type TopProductsQuery = z.infer<typeof topProductsQuerySchema>
export type PeakHoursQuery = z.infer<typeof peakHoursQuerySchema>
export type PaymentBreakdownQuery = z.infer<typeof paymentBreakdownQuerySchema>
export type RankingQuery = z.infer<typeof rankingQuerySchema>
