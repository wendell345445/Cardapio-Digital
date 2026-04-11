import { z } from 'zod'

// ─── TASK-093: Schema de Analytics ───────────────────────────────────────────

export const salesQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).default('week'),
})

export const topProductsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).default('week'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export const rankingQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
})

export type SalesQuery = z.infer<typeof salesQuerySchema>
export type TopProductsQuery = z.infer<typeof topProductsQuerySchema>
export type RankingQuery = z.infer<typeof rankingQuerySchema>
