import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useSocket } from '@/shared/hooks/useSocket'
import { useAuthStore } from '@/modules/auth/store/useAuthStore'
import {
  fetchConversations,
  fetchConversation,
  takeoverConversation,
  releaseConversation,
  sendAgentMessage,
} from '../services/conversations.service'

// ─── TASK-108: useConversations Hook (React Query + Socket.io) ───────────────

export function useConversations() {
  const storeId = useAuthStore((s) => s.user?.storeId ?? null)
  const socket = useSocket(storeId)
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
  })

  useEffect(() => {
    if (!socket) {
      console.log('[WS] useConversations: socket é null, sem listeners')
      return
    }
    console.log('[WS] useConversations: anexando listeners, socket.id=', socket.id, 'connected=', socket.connected)

    const handleUpdated = (event: { conversationId: string }) => {
      console.log('[WS] conversation:updated recebido', event)
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['conversation', event.conversationId] })
    }

    const handleTakeover = (event: { conversationId: string }) => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['conversation', event.conversationId] })
    }

    const handleReleased = (event: { conversationId: string }) => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['conversation', event.conversationId] })
    }

    socket.on('conversation:updated', handleUpdated)
    socket.on('conversation:takeover', handleTakeover)
    socket.on('conversation:released', handleReleased)

    return () => {
      socket.off('conversation:updated', handleUpdated)
      socket.off('conversation:takeover', handleTakeover)
      socket.off('conversation:released', handleReleased)
    }
  }, [socket, qc])

  const humanModeCount = (query.data ?? []).filter((c) => c.isHumanMode).length

  return { ...query, humanModeCount }
}

export function useConversation(id: string) {
  const storeId = useAuthStore((s) => s.user?.storeId ?? null)
  const socket = useSocket(storeId)
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => fetchConversation(id),
    enabled: Boolean(id),
  })

  useEffect(() => {
    if (!socket || !id) return

    const handle = (event: { conversationId: string }) => {
      if (event.conversationId === id) {
        qc.invalidateQueries({ queryKey: ['conversation', id] })
      }
    }

    socket.on('conversation:updated', handle)
    socket.on('conversation:takeover', handle)
    socket.on('conversation:released', handle)

    return () => {
      socket.off('conversation:updated', handle)
      socket.off('conversation:takeover', handle)
      socket.off('conversation:released', handle)
    }
  }, [socket, id, qc])

  return query
}

export function useTakeoverConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => takeoverConversation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  })
}

export function useReleaseConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => releaseConversation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  })
}

export function useSendAgentMessage(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => sendAgentMessage(conversationId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversation', conversationId] }),
  })
}
