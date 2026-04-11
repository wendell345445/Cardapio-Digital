import { prisma } from '../../shared/prisma/prisma'
import { AppError } from '../../shared/middleware/error.middleware'

// ─── TASK-097: WhatsApp Message Templates ────────────────────────────────────

export type WhatsAppEventType =
  | 'ORDER_CREATED'
  | 'WAITING_PAYMENT'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'DISPATCHED'
  | 'READY_FOR_PICKUP'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'MOTOBOY_ASSIGNED'
  | 'GREETING'
  | 'ABSENCE'

export const ALL_EVENT_TYPES: WhatsAppEventType[] = [
  'GREETING',
  'ABSENCE',
  'ORDER_CREATED',
  'WAITING_PAYMENT',
  'CONFIRMED',
  'PREPARING',
  'DISPATCHED',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'CANCELLED',
  'MOTOBOY_ASSIGNED',
]

export const DEFAULT_TEMPLATES: Record<WhatsAppEventType, string> = {
  GREETING:
    'Olá! Bem-vindo(a) à {{loja}}! 👋 Como posso te ajudar?',
  ABSENCE:
    'Olá! A {{loja}} está fechada no momento. Nosso horário: {{horario}}. Em breve retornamos! 😊',
  ORDER_CREATED:
    '✅ *Pedido #{{numero}} recebido — {{loja}}*\n\n{{itens}}\n\n*Total: {{total}}*\n\n🔗 Acompanhe seu pedido pelo link enviado.',
  WAITING_PAYMENT:
    '⏳ *Pedido #{{numero}} aguardando pagamento — {{loja}}*\n\nEnvie o comprovante Pix para confirmar seu pedido.\n*Total: {{total}}*',
  CONFIRMED:
    '✅ *Pedido #{{numero}} confirmado!*\n{{loja}} confirmou seu pedido e já está preparando. 🍕',
  PREPARING:
    '👨‍🍳 *Pedido #{{numero}} em preparo!*\n{{loja}} está preparando seu pedido. Aguarde!',
  DISPATCHED:
    '🛵 *Pedido #{{numero}} saiu para entrega!*\nSeu pedido está a caminho. Fique atento!',
  READY_FOR_PICKUP:
    '🏪 *Pedido #{{numero}} pronto para retirada!*\nSeu pedido está pronto. Pode vir buscar!',
  DELIVERED:
    '🎉 *Pedido #{{numero}} entregue!*\nEsperamos que aproveite! Obrigado pela preferência, {{loja}}.',
  CANCELLED:
    '❌ *Pedido #{{numero}} cancelado.*\nEntre em contato com {{loja}} para mais informações.',
  MOTOBOY_ASSIGNED:
    '🛵 *Novo pedido para entrega — #{{numero}}*\n\n👤 *Cliente:* {{cliente}}\n📍 *Endereço:* {{endereco}}\n\n{{itens}}\n\n💰 *Total:* {{total}}',
}

const EVENT_LABELS: Record<WhatsAppEventType, string> = {
  GREETING: 'Saudação',
  ABSENCE: 'Ausência',
  ORDER_CREATED: 'Pedido recebido',
  WAITING_PAYMENT: 'Aguardando pagamento (Pix)',
  CONFIRMED: 'Pedido confirmado',
  PREPARING: 'Em preparo',
  DISPATCHED: 'Saiu para entrega',
  READY_FOR_PICKUP: 'Pronto para retirada',
  DELIVERED: 'Pedido entregue',
  CANCELLED: 'Pedido cancelado',
  MOTOBOY_ASSIGNED: 'Motoboy designado',
}

export async function getWhatsAppMessages(storeId: string) {
  const customTemplates = await prisma.whatsAppTemplate.findMany({
    where: { storeId },
  })

  const customMap = new Map(customTemplates.map((t) => [t.eventType, t.template]))

  return ALL_EVENT_TYPES.map((eventType) => ({
    eventType,
    label: EVENT_LABELS[eventType],
    template: customMap.get(eventType) ?? DEFAULT_TEMPLATES[eventType],
    isCustom: customMap.has(eventType),
  }))
}

export async function updateWhatsAppMessage(
  storeId: string,
  eventType: WhatsAppEventType,
  template: string
) {
  if (!ALL_EVENT_TYPES.includes(eventType)) {
    throw new AppError('Tipo de evento inválido', 400)
  }

  const updated = await prisma.whatsAppTemplate.upsert({
    where: { storeId_eventType: { storeId, eventType } },
    create: { storeId, eventType, template },
    update: { template },
  })

  return updated
}

export async function resetWhatsAppMessage(
  storeId: string,
  eventType: WhatsAppEventType
) {
  if (!ALL_EVENT_TYPES.includes(eventType)) {
    throw new AppError('Tipo de evento inválido', 400)
  }

  await prisma.whatsAppTemplate.deleteMany({
    where: { storeId, eventType },
  })
}

/** Retorna template customizado ou default para uso interno (messages.service) */
export async function getTemplate(
  storeId: string,
  eventType: WhatsAppEventType
): Promise<string> {
  const custom = await prisma.whatsAppTemplate.findUnique({
    where: { storeId_eventType: { storeId, eventType } },
  })
  return custom?.template ?? DEFAULT_TEMPLATES[eventType]
}
