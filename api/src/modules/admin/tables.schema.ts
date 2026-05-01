import { z } from 'zod'

export const createTableSchema = z.object({
  number: z.number().int().min(1),
})

export const updateItemStatusSchema = z.object({
  status: z.enum(['PENDING', 'PREPARING', 'DELIVERED']),
})

export const closeTableSchema = z.object({
  applyServiceCharge: z.boolean().optional().default(false),
  serviceChargePercent: z.number().min(0).max(100).optional(),
})

export const setTablesCountSchema = z.object({
  count: z.number().int().min(0).max(200),
})

export const confirmTablePaymentSchema = z.object({
  paymentMethod: z.enum(['PIX', 'CASH', 'CREDIT', 'DEBIT']),
})

// Pagamento + fechamento numa só ação. Taxa de serviço entra antes da escolha
// do método pra que o garçom cobre o total certo do cliente.
export const settleTableSchema = z.object({
  paymentMethod: z.enum(['PIX', 'CASH', 'CREDIT', 'DEBIT']),
  applyServiceCharge: z.boolean().optional().default(false),
  serviceChargePercent: z.number().min(0).max(100).optional(),
})

export type CreateTableInput = z.infer<typeof createTableSchema>
export type UpdateItemStatusInput = z.infer<typeof updateItemStatusSchema>
export type CloseTableInput = z.infer<typeof closeTableSchema>
export type SetTablesCountInput = z.infer<typeof setTablesCountSchema>
export type ConfirmTablePaymentInput = z.infer<typeof confirmTablePaymentSchema>
export type SettleTableInput = z.infer<typeof settleTableSchema>
