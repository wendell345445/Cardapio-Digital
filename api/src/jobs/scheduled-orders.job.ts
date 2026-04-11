import Bull from 'bull'

import { prisma } from '../shared/prisma/prisma'
import { emit } from '../shared/socket/socket'

// ─── TASK-092: Job de Pedidos Agendados ───────────────────────────────────────

let scheduledOrdersQueue: Bull.Queue | null = null

export function getScheduledOrdersQueue(): Bull.Queue {
  if (!scheduledOrdersQueue) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    scheduledOrdersQueue = new Bull('scheduled-orders', redisUrl)

    scheduledOrdersQueue.process(async (job) => {
      const { orderId } = job.data
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { store: { select: { id: true, name: true } } },
      })

      if (!order || order.status === 'CANCELLED') return

      // Notify admin via Socket.io 15 min before scheduled time
      emit.orderScheduledAlert(order.storeId, {
        orderId: order.id,
        orderNumber: order.number,
        scheduledFor: order.scheduledFor,
        clientName: order.clientName,
        clientWhatsapp: order.clientWhatsapp,
      })
    })

    scheduledOrdersQueue.on('failed', (job, err) => {
      console.error(`Scheduled order job ${job.id} failed:`, err)
    })
  }

  return scheduledOrdersQueue
}

/**
 * Enqueue a 15-min-before alert for a scheduled order.
 * Delay = scheduledFor - 15min - now (ms)
 */
export async function enqueueScheduledOrderAlert(orderId: string, scheduledFor: Date) {
  const queue = getScheduledOrdersQueue()
  const alertAt = new Date(scheduledFor.getTime() - 15 * 60 * 1000)
  const delay = Math.max(0, alertAt.getTime() - Date.now())

  await queue.add({ orderId }, { delay, jobId: `scheduled-order-${orderId}`, attempts: 3 })
}
