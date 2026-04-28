import { z } from 'zod'

// ─── TASK-065: Pedidos Públicos ───────────────────────────────────────────────

// Aceita 11 dígitos no padrão de celular brasileiro: DDD (11–99) + 9 + 8 dígitos.
// Não valida que o número está cadastrado no WhatsApp — só formato.
const brMobileRegex = /^[1-9][0-9]9[0-9]{8}$/

export const createOrderSchema = z.object({
  clientWhatsapp: z
    .string()
    .length(11, 'WhatsApp deve ter 11 dígitos')
    .regex(brMobileRegex, 'Informe um celular brasileiro válido (DDD + 9 + 8 dígitos)'),
  clientName: z.string().min(1).optional(),
  customerSessionId: z.string().uuid().optional(),
  type: z.enum(['DELIVERY', 'PICKUP', 'TABLE']),
  paymentMethod: z.enum([
    'PIX',
    'CREDIT_CARD',
    'CASH_ON_DELIVERY',
    'CREDIT_ON_DELIVERY',
    'DEBIT_ON_DELIVERY',
    'PIX_ON_DELIVERY',
    'PENDING',
  ]),
  notes: z.string().optional(),
  couponCode: z.string().optional(),
  tableId: z.string().uuid().optional(),
  // C-002/C-022: cliente escaneia QR e abre /menu?mesa=N — frontend manda só o número
  tableNumber: z.number().int().positive().optional(),
  address: z
    .object({
      zipCode: z.string().optional(),
      street: z.string().min(1),
      number: z.string().min(1),
      complement: z.string().optional(),
      neighborhood: z.string().min(1),
      city: z.string().min(1),
      state: z.string().optional(),
    })
    .optional(),
  scheduledFor: z.coerce.date().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variationId: z.string().uuid().optional(),
        quantity: z.number().int().min(1),
        notes: z.string().optional(),
        additionalIds: z.array(z.string().uuid()).default([]),
      })
    )
    .min(1, 'Pedido deve ter pelo menos 1 item'),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
