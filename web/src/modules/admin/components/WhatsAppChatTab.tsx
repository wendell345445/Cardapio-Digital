import { useState } from 'react'
import { MessageCircle, Bot, User } from 'lucide-react'


import { useConversations } from '../hooks/useConversations'
import type { Conversation } from '../services/conversations.service'
import { ConversationView } from './ConversationView'

// ─── TASK-112: WhatsApp Chat Tab — Lista de Conversas (Epic 10) ───────────────

export function WhatsAppChatTab() {
  const { data: conversations, isLoading } = useConversations()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (selectedId) {
    return (
      <ConversationView
        conversationId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-20" />
        ))}
      </div>
    )
  }

  if (!conversations?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-3">
        <MessageCircle size={48} className="opacity-30" />
        <p className="text-center text-sm">
          Nenhuma conversa ainda.
          <br />
          Quando um cliente mandar mensagem, aparece aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {conversations.map((conv) => (
        <ConversationRow key={conv.id} conversation={conv} onClick={() => setSelectedId(conv.id)} />
      ))}
    </div>
  )
}

function ConversationRow({
  conversation,
  onClick,
}: {
  conversation: Conversation
  onClick: () => void
}) {
  const lastMessage = conversation.messages?.[0]
  const displayName = conversation.customerName || conversation.customerPhone

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 p-4 rounded-xl border transition-colors hover:bg-gray-50 ${
        conversation.isHumanMode ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
        <User size={20} className="text-gray-500" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-gray-900 truncate">{displayName}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {lastMessage && (
              <span className="text-xs text-gray-400">
                {new Date(lastMessage.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {/* Mode badge */}
            {conversation.isHumanMode ? (
              <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                <User size={10} /> Humano
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                <Bot size={10} /> IA
              </span>
            )}
          </div>
        </div>
        {lastMessage && (
          <p className="text-sm text-gray-500 truncate mt-0.5">
            {lastMessage.role === 'CUSTOMER' ? '' : lastMessage.role === 'AGENT' ? 'Você: ' : '🤖 '}
            {lastMessage.content}
          </p>
        )}
      </div>
    </button>
  )
}
