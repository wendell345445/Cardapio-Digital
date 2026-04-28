// TASK-130 (parte 2): opt-in de notificações por pedido via WhatsApp.
//
// Cliente finaliza pedido na web (sem digitar WhatsApp) → vê link wa.me com
// texto pronto "quero receber status do meu pedido #42". Quando a mensagem cai
// no inbound, este módulo detecta "#42", casa pelo número do pedido na loja
// (sem checar clientWhatsapp — pedido nasce sem ele), filtra por janela de
// 24h E status aberto pra reduzir risco de impostor adivinhando números, seta
// `clientWhatsapp = senderPhone` + `notifyOnStatusChange = true` e responde
// com confirmação + status atual.

import { prisma } from '../../shared/prisma/prisma'
import { emit } from '../../shared/socket/socket'

import { renderAndEnqueueStatusMessage } from './messages.service'
import { enqueueWhatsApp } from './whatsapp.queue'

const ORDER_NUMBER_REGEX = /#\s*(\d{1,8})/

// Janela em que um pedido fica elegível pro opt-in. 24h cobre o caso natural
// (cliente faz pedido, recebe atualizações até a entrega/finalização).
const OPT_IN_WINDOW_HOURS = 24

// Status considerados "abertos" pra opt-in. Pedido entregue/cancelado não
// recebe mais notificações — opt-in nesse momento não tem sentido.
const OPEN_STATUSES = [
  'WAITING_PAYMENT',
  'WAITING_PAYMENT_PROOF',
  'WAITING_CONFIRMATION',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DISPATCHED',
]

const STATUS_LABEL: Record<string, string> = {
  WAITING_CONFIRMATION: 'Aguardando confirmação',
  WAITING_PAYMENT: 'Aguardando pagamento',
  WAITING_PAYMENT_PROOF: 'Aguardando comprovante de pagamento',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
  DISPATCHED: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
}

/**
 * Tenta processar opt-in a partir de uma mensagem inbound. Se a mensagem contém
 * "#N" e existe pedido N na loja criado nas últimas 24h e ainda em aberto,
 * adota o número do remetente como `clientWhatsapp`, ativa a flag, envia
 * confirmação + status atual e retorna true.
 *
 * Retorna false se nada matchar — caller segue com o fluxo normal (greeting/AI).
 */
export async function tryHandleOptIn(
  storeId: string,
  senderPhone: string,
  text: string
): Promise<boolean> {
  const match = text.match(ORDER_NUMBER_REGEX)
  if (!match) return false

  const orderNumber = parseInt(match[1], 10)
  if (!Number.isFinite(orderNumber) || orderNumber <= 0) return false

  const cutoff = new Date(Date.now() - OPT_IN_WINDOW_HOURS * 60 * 60 * 1000)

  const order = await prisma.order.findFirst({
    where: {
      storeId,
      number: orderNumber,
      createdAt: { gte: cutoff },
      status: { in: OPEN_STATUSES as any },
    },
    select: {
      id: true,
      number: true,
      status: true,
      type: true,
      total: true,
      clientWhatsapp: true,
      notifyOnStatusChange: true,
      store: { select: { id: true, name: true } },
    },
  })
  if (!order) return false

  // Adota o número do remetente como contato do pedido se ainda não houver,
  // ou se o cliente fez opt-in de outro device (ex: número diferente).
  const needsUpdate = !order.notifyOnStatusChange || order.clientWhatsapp !== senderPhone
  if (needsUpdate) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        clientWhatsapp: senderPhone,
        notifyOnStatusChange: true,
      },
    })
    // Refresh em tempo real da OrderTrackingPage (esconde o card de opt-in)
    // e da fila do admin (sinaliza que o cliente entrou no opt-in).
    emit.orderStatus(storeId, { orderId: order.id, status: order.status })
  }

  // Cliente mandou "#N" pra acompanhar o pedido — quer interagir com o fluxo
  // automático. Tira a conversa do modo humano (se estava). O atendente
  // humano pode reassumir manualmente clicando "Atender" depois.
  const conversation = await prisma.conversation.findUnique({
    where: { storeId_customerPhone: { storeId, customerPhone: senderPhone } },
    select: { id: true, isHumanMode: true },
  })
  if (conversation?.isHumanMode) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { isHumanMode: false },
    })
    emit.conversationUpdated(storeId, { conversationId: conversation.id, isHumanMode: false })
  }

  const statusLabel = STATUS_LABEL[order.status] ?? order.status
  const confirmationText =
    `✅ Pronto! Você receberá atualizações do pedido *#${order.number}* aqui no WhatsApp.\n\n` +
    `Status atual: *${statusLabel}*`

  await enqueueWhatsApp({
    storeId,
    to: senderPhone,
    text: confirmationText,
    type: 'ORDER',
  })

  // Mensagem extra com o template do status atual (caso a loja tenha texto customizado).
  // renderAndEnqueueStatusMessage não checa a flag — é o que queremos aqui.
  try {
    await renderAndEnqueueStatusMessage(
      storeId,
      senderPhone,
      order.number,
      order.status,
      order.store.name,
      order.type,
      { total: order.total }
    )
  } catch {
    // Se template do status atual não estiver mapeado (ex: WAITING_PAYMENT_PROOF
    // sem template configurado), a confirmação acima já é suficiente.
  }

  return true
}
