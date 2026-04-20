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

export const updateOrderAddressSchema = z.object({
  zipCode: z.string().trim().regex(/^\d{5}-?\d{3}$/, 'CEP inválido').optional(),
  street: z.string().trim().min(1, 'Rua obrigatória').max(200),
  number: z.string().trim().min(1, 'Número obrigatório').max(20),
  complement: z.string().trim().max(200).optional().nullable(),
  neighborhood: z.string().trim().min(1, 'Bairro obrigatório').max(120),
  city: z.string().trim().min(1, 'Cidade obrigatória').max(120),
  state: z.string().trim().max(2).optional().nullable(),
})

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>
export type AssignMotoboyInput = z.infer<typeof assignMotoboySchema>
export type ListOrdersInput = z.infer<typeof listOrdersSchema>
export type UpdateOrderAddressInput = z.infer<typeof updateOrderAddressSchema>
