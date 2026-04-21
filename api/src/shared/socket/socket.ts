import { Server as HttpServer } from 'http'

import { Server, Socket } from 'socket.io'

let io: Server | null = null

export function initSocket(httpServer: HttpServer): Server {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',')
  const rootDomain = process.env.PUBLIC_ROOT_DOMAIN || 'menupanda.com.br'
  const allowedSuffixes = (
    process.env.ALLOWED_ORIGIN_SUFFIXES || `.cardapio.test,.${rootDomain}`
  ).split(',')

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true)
        if (allowedOrigins.includes(origin)) return callback(null, true)
        try {
          const hostname = new URL(origin).hostname
          const allowed = allowedSuffixes.some(
            (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix)
          )
          callback(null, allowed)
        } catch {
          callback(null, false)
        }
      },
      credentials: true,
    },
  })

  io.on('connection', (socket: Socket) => {
    const { storeId } = socket.handshake.auth as { storeId?: string }

    if (storeId) {
      socket.join(`store:${storeId}`)
      console.log(`Socket ${socket.id} joined store:${storeId}`)
    }

    // Join table room for real-time comanda updates
    socket.on('join-table', (tableId: string) => {
      if (storeId && tableId) {
        socket.join(`table:${storeId}:${tableId}`)
      }
    })

    socket.on('disconnect', () => {
      console.log(`Socket ${socket.id} disconnected`)
    })
  })

  return io
}

export function getIo(): Server {
  if (!io) throw new Error('Socket.io not initialized. Call initSocket() first.')
  return io
}

export const emit = {
  orderUpdated(storeId: string, order: unknown): void {
    io?.to(`store:${storeId}`).emit('order:updated', order)
  },

  orderNew(storeId: string, order: unknown): void {
    io?.to(`store:${storeId}`).emit('order:new', order)
  },

  orderStatus(storeId: string, data: { orderId: string; status: string }): void {
    io?.to(`store:${storeId}`).emit('order:status', data)
  },

  menuUpdated(storeId: string): void {
    io?.to(`store:${storeId}`).emit('menu:updated')
  },

  itemStatus(storeId: string, tableId: string, data: { itemId: string; status: string }): void {
    io?.to(`table:${storeId}:${tableId}`).emit('item:status', data)
  },

  // ─── A-056: Cliente pede a conta ────────────────────────────────────────
  tableCheckRequested(storeId: string, data: { tableId: string; tableNumber: number; customerWhatsapp: string }): void {
    io?.to(`store:${storeId}`).emit('table:check_requested', data)
  },

  // ─── TASK-092: Alerta de pedido agendado ─────────────────────────────────
  orderScheduledAlert(storeId: string, data: unknown): void {
    io?.to(`store:${storeId}`).emit('order:scheduled_alert', data)
  },

  // ─── TASK-095: Eventos de caixa ─────────────────────────────────────────
  cashFlowUpdated(storeId: string, data: unknown): void {
    io?.to(`store:${storeId}`).emit('cashflow:updated', data)
  },

  // ─── TASK-107: Eventos de conversa WhatsApp ──────────────────────────────
  conversationUpdated(storeId: string, data: unknown): void {
    io?.to(`store:${storeId}`).emit('conversation:updated', data)
  },

  conversationTakeover(storeId: string, data: unknown): void {
    io?.to(`store:${storeId}`).emit('conversation:takeover', data)
  },

  conversationReleased(storeId: string, data: unknown): void {
    io?.to(`store:${storeId}`).emit('conversation:released', data)
  },
}
