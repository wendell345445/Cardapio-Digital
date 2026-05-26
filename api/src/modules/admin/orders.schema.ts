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

// Helper: transforma string vazia em undefined (o form envia "" quando o campo é opcional)
const emptyToUndefined = z.literal('').transform(() => undefined)

export const updateOrderAddressSchema = z.object({
  zipCode: z.union([
    z.string().trim().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
    emptyToUndefined,
  ]).optional(),
  street: z.string().trim().min(1, 'Rua obrigatória').max(200),
  number: z.string().trim().min(1, 'Número obrigatório').max(20),
  complement: z.union([z.string().trim().max(200), emptyToUndefined]).optional().nullable(),
  neighborhood: z.string().trim().min(1, 'Bairro obrigatório').max(120),
  city: z.string().trim().min(1, 'Cidade obrigatória').max(120),
  state: z.union([z.string().trim().max(2), emptyToUndefined]).optional().nullable(),
})

// ─── PDV: Criar pedido pelo admin (telefone/balcão) ──────────────────────────
// Reaproveita o motor `createOrder` da camada menu. Diferenças do schema público:
//   - mesa é selecionada por `tableId` (o atendente nunca lida com QR/token);
//     o service abre/anexa a TableSession por baixo via openOrJoinSession.
//   - aceita os métodos de pagamento "limpos" (CASH/CREDIT/DEBIT) usados em
//     cobrança presencial de balcão, além dos *_ON_DELIVERY e PIX/PENDING.
//   - sem `customerSessionId` (não há sessão de navegador de cliente no admin).
export const createAdminOrderSchema = z
  .object({
    clientName: z.string().trim().min(1, 'Informe o nome do cliente'),
    // Telefone informado pelo atendente (pedido por telefone/balcão).
    clientWhatsapp: z.string().trim().optional(),
    type: z.enum(['DELIVERY', 'PICKUP', 'TABLE']),
    paymentMethod: z.enum([
      'PIX',
      'CASH',
      'CREDIT',
      'DEBIT',
      'CASH_ON_DELIVERY',
      'CREDIT_ON_DELIVERY',
      'DEBIT_ON_DELIVERY',
      'PIX_ON_DELIVERY',
      'PENDING',
    ]),
    notes: z.string().optional(),
    couponCode: z.string().optional(),
    // Mesa: o atendente seleciona a mesa; o service resolve/abre a sessão.
    tableId: z.string().uuid().optional(),
    // Nome que aparece pra cozinha (default "Balcão" no service quando vazio).
    deviceName: z.string().trim().max(40).optional(),
    deliveryNeighborhoodId: z.string().uuid().optional(),
    address: z
      .object({
        zipCode: z.string().optional(),
        street: z.string().min(1),
        number: z.string().min(1),
        complement: z.string().optional(),
        reference: z.string().optional(),
        neighborhood: z.string().min(1).optional(),
        city: z.string().min(1).optional(),
        state: z.string().optional(),
        manualCoordinates: z
          .object({
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
          })
          .optional(),
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
          addonIds: z.array(z.string().uuid()).default([]),
        })
      )
      .min(1, 'Pedido deve ter pelo menos 1 item'),
  })
  // Falha cedo (400) em vez de deixar o motor lançar 422 em runtime.
  .refine((d) => d.type !== 'TABLE' || !!d.tableId, {
    message: 'Selecione a mesa do pedido',
    path: ['tableId'],
  })
  .refine((d) => d.type !== 'DELIVERY' || !!d.address, {
    message: 'Endereço é obrigatório para entrega',
    path: ['address'],
  })

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>
export type AssignMotoboyInput = z.infer<typeof assignMotoboySchema>
export type ListOrdersInput = z.infer<typeof listOrdersSchema>
export type UpdateOrderAddressInput = z.infer<typeof updateOrderAddressSchema>
export type CreateAdminOrderInput = z.infer<typeof createAdminOrderSchema>
