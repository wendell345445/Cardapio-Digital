// TASK-130: opt-in de notificações por pedido via WhatsApp.
//
// Cliente finaliza pedido na web → vê link wa.me com texto pré-preenchido
// "Olá, quero receber status do meu pedido #42". Quando essa mensagem cai
// no inbound, este módulo detecta o "#42", localiza o pedido cuja loja é a
// que recebeu a mensagem e cujo clientWhatsapp bate com o número do remetente,
// seta notifyOnStatusChange=true e responde com confirmação + status atual.

import { prisma } from '../../shared/prisma/prisma'
import { emit } from '../../shared/socket/socket'

import { renderAndEnqueueStatusMessage } from './messages.service'
import { enqueueWhatsApp } from './whatsapp.queue'

const ORDER_NUMBER_REGEX = /#\s*(\d{1,8})/

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
 * "#N" e existe pedido N na loja com clientWhatsapp = senderPhone, ativa a flag,
 * envia confirmação + status atual e retorna true.
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

  const order = await prisma.order.findFirst({
    where: {
      storeId,
      number: orderNumber,
      clientWhatsapp: senderPhone,
    },
    select: {
      id: true,
      number: true,
      status: true,
      type: true,
      total: true,
      notifyOnStatusChange: true,
      store: { select: { id: true, name: true } },
    },
  })
  if (!order) return false

  if (!order.notifyOnStatusChange) {
    await prisma.order.update({
      where: { id: order.id },
      data: { notifyOnStatusChange: true },
    })
    // Refresh em tempo real da OrderTrackingPage (esconde o card de opt-in)
    // e da fila do admin (sinaliza que o cliente entrou no opt-in).
    emit.orderStatus(storeId, { orderId: order.id, status: order.status })
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
