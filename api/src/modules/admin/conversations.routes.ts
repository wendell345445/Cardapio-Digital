import { Router } from 'express'

import { authMiddleware, requireRole, extractStoreId, requireStore, requireActiveStore } from '../../shared/middleware/auth.middleware'

import {
  listConversationsController,
  getConversationController,
  takeoverConversationController,
  releaseConversationController,
  sendAgentMessageController,
} from './conversations.controller'

// ─── TASK-103: Conversations Routes (Epic 10 — WhatsApp Chat) ────────────────

const conversationsRouter = Router()

conversationsRouter.use(authMiddleware, requireRole('ADMIN'), extractStoreId, requireStore, requireActiveStore)

conversationsRouter.get('/', listConversationsController)
conversationsRouter.get('/:id', getConversationController)
conversationsRouter.post('/:id/takeover', takeoverConversationController)
conversationsRouter.post('/:id/release', releaseConversationController)
conversationsRouter.post('/:id/message', sendAgentMessageController)

export default conversationsRouter
