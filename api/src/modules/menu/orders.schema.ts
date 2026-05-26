import { z } from 'zod'

// ─── TASK-065: Pedidos Públicos ───────────────────────────────────────────────
// TASK-130 (parte 2): cliente não digita mais WhatsApp no checkout. O número
// vem depois, via opt-in inbound (/whatsapp/opt-in.service). Pedido nasce
// sem clientWhatsapp; nome é obrigatório (era opcional).

export const createOrderSchema = z.object({
  clientName: z.string().min(1, 'Informe seu nome'),
  customerSessionId: z.string().uuid().optional(),
  type: z.enum(['DELIVERY', 'PICKUP', 'TABLE']),
  paymentMethod: z.enum([
    'PIX',
    'CASH_ON_DELIVERY',
    'CREDIT_ON_DELIVERY',
    'DEBIT_ON_DELIVERY',
    'PIX_ON_DELIVERY',
    'PENDING',
  ]),
  notes: z.string().optional(),
  couponCode: z.string().optional(),
  tableId: z.string().uuid().optional(),
  // Pedido em mesa: cliente passa pelo entry-point /mesa/:n que abre/entra
  // numa TableSession e devolve um token. Esse token vem aqui no createOrder
  // — sem ele, type=TABLE é rejeitado (link antigo ?mesa=N perde o poder).
  tableSessionToken: z.string().min(20).optional(),
  deviceName: z.string().trim().max(40).optional(),
  // Modo bairro: cliente seleciona um bairro cadastrado e backend cobra a taxa fixa.
  // Quando enviado, ignora address.manualCoordinates / geocode para fins de taxa.
  deliveryNeighborhoodId: z.string().uuid().optional(),
  address: z
    .object({
      zipCode: z.string().optional(),
      street: z.string().min(1),
      number: z.string().min(1),
      complement: z.string().optional(),
      // Ponto de referência ("portão azul", "ao lado da padaria"). Separado do
      // complement pra impressão/entrega. Pedidos antigos podem ter ref grudada
      // no complement (legado " | ") — buildReceiptData desfaz isso na leitura.
      reference: z.string().optional(),
      // No modo bairro o cliente não preenche cidade (o sheet esconde o campo) —
      // a cidade vem implícita pelo bairro cadastrado pela loja. Por isso
      // city/neighborhood são opcionais aqui; o service valida coerência.
      neighborhood: z.string().min(1).optional(),
      city: z.string().min(1).optional(),
      state: z.string().optional(),
      // Cliente preenche manualmente quando o Google não acha o endereço:
      // copia lat/lng do Google Maps. Backend confia, pula geocoding e usa
      // direto pra calcular taxa.
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
        // v2.9: addonIds referencia Addon.id (não mais ProductAdditional.id).
        // Backend valida que cada Addon está vinculado ao produto via ProductAddon.
        addonIds: z.array(z.string().uuid()).default([]),
      })
    )
    .min(1, 'Pedido deve ter pelo menos 1 item'),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
