import { Request, Response } from 'express'
import { z } from 'zod'

import { AppError } from '../../shared/middleware/error.middleware'
import {
  getConversations,
  getConversationById,
  takeoverConversation,
  releaseConversation,
  sendAgentMessage,
} from './conversations.service'

// ─── TASK-103: Conversations Controller (Epic 10 — WhatsApp Chat) ─────────────

const sendMessageSchema = z.object({
  content: z.string().min(1, 'Mensagem não pode ser vazia'),
})

export async function listConversationsController(req: Request, res: Response) {
  const storeId = req.tenant!.storeId
  const conversations = await getConversations(storeId)
  res.json({ success: true, data: conversations })
}

export async function getConversationController(req: Request, res: Response) {
  const storeId = req.tenant!.storeId
  const { id } = req.params
  const conversation = await getConversationById(storeId, id)
  res.json({ success: true, data: conversation })
}

export async function takeoverConversationController(req: Request, res: Response) {
  const storeId = req.tenant!.storeId
  const { id } = req.params
  const agentId = req.user!.userId
  const result = await takeoverConversation(storeId, id, agentId)
  res.json({ success: true, data: result })
}

export async function releaseConversationController(req: Request, res: Response) {
  const storeId = req.tenant!.storeId
  const { id } = req.params
  const result = await releaseConversation(storeId, id)
  res.json({ success: true, data: result })
}

export async function sendAgentMessageController(req: Request, res: Response) {
  const storeId = req.tenant!.storeId
  const { id } = req.params

  const parsed = sendMessageSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0].message, 400)
  }

  const message = await sendAgentMessage(storeId, id, parsed.data.content)
  res.json({ success: true, data: message })
}
