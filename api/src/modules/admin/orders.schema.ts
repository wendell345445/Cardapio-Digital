import { z } from 'zod'

// ─── TASK-080: Schema de Pedidos Admin ───────────────────────────────────────

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'CONFIRMED',
    'PREPARING',
    'READY',
    'DISPATCHED',
    'DELIVERED',
    'CANCELLED',
  ]),
  cancelReason: z.string().optional(),
})

export const assignMotoboySchema = z.object({
  motoboyId: z.string().uuid(),
})

export const listOrdersSchema = z.object({
  status: z.string().optional(),
  paymentMethod: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().default(20),
})

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>
export type AssignMotoboyInput = z.infer<typeof assignMotoboySchema>
export type ListOrdersInput = z.infer<typeof listOrdersSchema>
