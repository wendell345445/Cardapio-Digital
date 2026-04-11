import { z } from 'zod'

// ─── TASK-095: Schema de Controle de Caixa ───────────────────────────────────

export const openCashFlowSchema = z.object({
  initialAmount: z.number().nonnegative().default(0),
})

export const closeCashFlowSchema = z.object({
  countedAmount: z.number().nonnegative(),
  justification: z.string().optional(),
})

export const adjustmentSchema = z.object({
  type: z.enum(['BLEED', 'SUPPLY']),
  amount: z.number().positive(),
  notes: z.string().optional(),
})

export const updateInitialAmountSchema = z.object({
  initialAmount: z.number().nonnegative(),
})

export type OpenCashFlowInput = z.infer<typeof openCashFlowSchema>
export type CloseCashFlowInput = z.infer<typeof closeCashFlowSchema>
export type AdjustmentInput = z.infer<typeof adjustmentSchema>
export type UpdateInitialAmountInput = z.infer<typeof updateInitialAmountSchema>
