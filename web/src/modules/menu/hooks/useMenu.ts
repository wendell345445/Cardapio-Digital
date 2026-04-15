import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'

import { fetchMenu } from '../services/menu.service'

// ─── TASK-124: slug removido da assinatura — hostname identifica a loja ──────
// O parâmetro slug é mantido como chave de query para compatibilidade com
// componentes que ainda o passam (ex: useStoreSlug() retorna null no domínio raiz).

export function useMenu(slug: string | null) {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['menu', slug],
    queryFn: () => fetchMenu(),
    staleTime: 5 * 60 * 1000,
    enabled: !!slug,
  })

  // Socket.io: escutar menu:updated → invalidate
  useEffect(() => {
    if (!query.data?.store.id) return
    const storeId = query.data.store.id
    const socket = io(import.meta.env.VITE_API_URL ?? '/', {
      auth: { storeId },
      transports: ['websocket'],
    })
    socket.on('menu:updated', () => {
      qc.invalidateQueries({ queryKey: ['menu', slug] })
    })
    return () => { socket.disconnect() }
  }, [query.data?.store.id, slug, qc])

  return query
}
