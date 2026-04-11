import { api } from '@/shared/lib/api'

// ─── TASK-108: Conversations Service (Epic 10 — WhatsApp Chat) ───────────────

export interface ConversationMessage {
  id: string
  conversationId: string
  role: 'CUSTOMER' | 'AI' | 'AGENT' | 'SYSTEM'
  content: string
  createdAt: string
}

export interface Conversation {
  id: string
  storeId: string
  customerPhone: string
  customerName: string | null
  isHumanMode: boolean
  humanAgentId: string | null
  createdAt: string
  updatedAt: string
  messages: ConversationMessage[]
}

export async function fetchConversations(): Promise<Conversation[]> {
  const { data } = await api.get('/admin/whatsapp/conversations')
  return data.data
}

export async function fetchConversation(id: string): Promise<Conversation> {
  const { data } = await api.get(`/admin/whatsapp/conversations/${id}`)
  return data.data
}

export async function takeoverConversation(id: string): Promise<Conversation> {
  const { data } = await api.post(`/admin/whatsapp/conversations/${id}/takeover`)
  return data.data
}

export async function releaseConversation(id: string): Promise<Conversation> {
  const { data } = await api.post(`/admin/whatsapp/conversations/${id}/release`)
  return data.data
}

export async function sendAgentMessage(id: string, content: string): Promise<ConversationMessage> {
  const { data } = await api.post(`/admin/whatsapp/conversations/${id}/message`, { content })
  return data.data
}
