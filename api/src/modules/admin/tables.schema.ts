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

export type CreateTableInput = z.infer<typeof createTableSchema>
export type UpdateItemStatusInput = z.infer<typeof updateItemStatusSchema>
export type CloseTableInput = z.infer<typeof closeTableSchema>
