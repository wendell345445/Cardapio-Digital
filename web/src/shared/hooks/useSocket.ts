import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

import { useAuthStore } from '@/modules/auth/store/useAuthStore'

export function useSocket(storeId: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!storeId || !token) return

    const sock = io('/', {
      auth: { storeId, token },
      transports: ['websocket'],
    })

    setSocket(sock)

    sock.on('connect', () => {
      console.log('Socket connected:', sock.id)
    })

    sock.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    return () => {
      sock.disconnect()
      setSocket(null)
    }
  }, [storeId, token])

  return socket
}
