import { logger } from '../../shared/logger/logger'
import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { emit } from '../../shared/socket/socket'
import { sendMessage, sendMessageDirect, type SendResult } from '../whatsapp/whatsapp.service'

/** Envia mensagem usando waJid direto (confiável) ou fallback por telefone */
async function sendToCustomer(
  storeId: string,
  phone: string,
  text: string,
  waJid?: string | null
): Promise<SendResult> {
  if (waJid) {
    return sendMessageDirect(storeId, waJid, text)
  }
  return sendMessage(storeId, phone, text)
}

// ─── TASK-102: Conversations Service (Epic 10 — WhatsApp Chat) ───────────────

export async function getConversations(storeId: string) {
  return prisma.conversation.findMany({
    where: { storeId },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
}

export async function getConversationById(storeId: string, id: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!conversation || conversation.storeId !== storeId) {
    throw new AppError('Conversa não encontrada', 404)
  }

  return conversation
}

export async function takeoverConversation(storeId: string, id: string, agentId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id } })
  if (!conversation || conversation.storeId !== storeId) {
    throw new AppError('Conversa não encontrada', 404)
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: { isHumanMode: true, humanAgentId: agentId },
  })

  await prisma.conversationMessage.create({
    data: {
      conversationId: id,
      role: 'SYSTEM',
      content: 'Atendente humano assumiu o atendimento.',
    },
  })

  const takeoverResult = await sendToCustomer(
    storeId,
    conversation.customerPhone,
    '👨‍💼 Um atendente humano está te atendendo agora!',
    conversation.waJid
  )
  if (!takeoverResult.ok) {
    logger.warn({ storeId, id, reason: takeoverResult.reason }, '[Conversations] takeover notice falhou')
  }

  emit.conversationTakeover(storeId, { conversationId: id, isHumanMode: true })

  return updated
}

export async function releaseConversation(storeId: string, id: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id } })
  if (!conversation || conversation.storeId !== storeId) {
    throw new AppError('Conversa não encontrada', 404)
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: { isHumanMode: false, humanAgentId: null },
  })

  await prisma.conversationMessage.create({
    data: {
      conversationId: id,
      role: 'SYSTEM',
      content: 'Atendimento devolvido para o sistema automático.',
    },
  })

  const releaseResult = await sendToCustomer(
    storeId,
    conversation.customerPhone,
    '🤖 Voltei ao atendimento automático!',
    conversation.waJid
  )
  if (!releaseResult.ok) {
    logger.warn({ storeId, id, reason: releaseResult.reason }, '[Conversations] release notice falhou')
  }

  emit.conversationReleased(storeId, { conversationId: id, isHumanMode: false })

  return updated
}

export async function sendAgentMessage(storeId: string, id: string, content: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id } })
  if (!conversation || conversation.storeId !== storeId) {
    throw new AppError('Conversa não encontrada', 404)
  }

  if (!conversation.isHumanMode) {
    throw new AppError('Só é possível enviar mensagens em modo humano. Assuma a conversa primeiro.', 400)
  }

  const sendResult = await sendToCustomer(storeId, conversation.customerPhone, content, conversation.waJid)
  if (!sendResult.ok) {
    throw new AppError(
      'Não foi possível entregar a mensagem — a loja não está conectada ao WhatsApp agora.',
      422,
      'WHATSAPP_UNAVAILABLE'
    )
  }

  const message = await prisma.conversationMessage.create({
    data: {
      conversationId: id,
      role: 'AGENT',
      content,
    },
  })

  await prisma.conversation.update({
    where: { id },
    data: { updatedAt: new Date() },
  })

  emit.conversationUpdated(storeId, { conversationId: id, message })

  return message
}
