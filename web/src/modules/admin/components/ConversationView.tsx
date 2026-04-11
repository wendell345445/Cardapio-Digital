import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Bot, Send, User } from 'lucide-react'

import { useConversation, useReleaseConversation, useSendAgentMessage, useTakeoverConversation } from '../hooks/useConversations'
import type { ConversationMessage } from '../services/conversations.service'

// ─── TASK-113: ConversationView — Chat em Tempo Real (Epic 10) ────────────────

interface Props {
  conversationId: string
  onBack: () => void
}

export function ConversationView({ conversationId, onBack }: Props) {
  const { data: conversation, isLoading } = useConversation(conversationId)
  const takeover = useTakeoverConversation()
  const release = useReleaseConversation()
  const sendMsg = useSendAgentMessage(conversationId)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll para última mensagem
  useEffect(() => {
    if (bottomRef.current && typeof bottomRef.current.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversation?.messages])

  function handleSend() {
    const text = input.trim()
    if (!text || sendMsg.isPending) return
    sendMsg.mutate(text)
    setInput('')
  }

  if (isLoading || !conversation) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const displayName = conversation.customerName || conversation.customerPhone

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
        <button onClick={onBack} className="p-1 rounded hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{displayName}</p>
          <p className="text-xs text-gray-500">{conversation.customerPhone}</p>
        </div>
        {/* Takeover / Release */}
        {conversation.isHumanMode ? (
          <button
            onClick={() => release.mutate(conversationId)}
            disabled={release.isPending}
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
          >
            Devolver para IA/Bot
          </button>
        ) : (
          <button
            onClick={() => takeover.mutate(conversationId)}
            disabled={takeover.isPending}
            className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            Assumir Atendimento
          </button>
        )}
      </div>

      {/* Mode banner */}
      <div
        className={`px-4 py-2 text-xs font-medium text-center ${
          conversation.isHumanMode
            ? 'bg-blue-50 text-blue-700'
            : 'bg-green-50 text-green-700'
        }`}
      >
        {conversation.isHumanMode ? (
          <>👨‍💼 Modo Humano — você está respondendo diretamente ao cliente</>
        ) : (
          <>🤖 Modo IA/Bot — a IA está respondendo automaticamente</>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {conversation.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {conversation.isHumanMode ? (
        <div className="pt-3 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Digite uma mensagem..."
              disabled={sendMsg.isPending}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sendMsg.isPending}
              className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs text-center text-gray-400">
            A IA está respondendo. Clique em <strong>Assumir Atendimento</strong> para enviar mensagens manualmente.
          </p>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const time = new Date(message.createdAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (message.role === 'SYSTEM') {
    return (
      <div className="flex justify-center">
        <span className="text-xs italic text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  const isRight = message.role === 'AGENT' || message.role === 'AI'

  const bubbleColor =
    message.role === 'CUSTOMER'
      ? 'bg-gray-100 text-gray-900'
      : message.role === 'AGENT'
      ? 'bg-blue-100 text-blue-900'
      : 'bg-amber-100 text-amber-900'

  const label =
    message.role === 'CUSTOMER'
      ? null
      : message.role === 'AGENT'
      ? <span className="flex items-center gap-1"><User size={10} /> Você</span>
      : <span className="flex items-center gap-1"><Bot size={10} /> IA</span>

  return (
    <div className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${bubbleColor}`}>
        {label && (
          <p className="text-xs font-semibold opacity-60 mb-1">{label}</p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <p className="text-xs opacity-50 mt-1 text-right">{time}</p>
      </div>
    </div>
  )
}
