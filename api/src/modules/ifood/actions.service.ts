import { isAxiosError } from 'axios'

import { logger } from '../../shared/logger/logger'
import { prisma } from '../../shared/prisma/prisma'
import { withStoreLock } from '../../shared/utils/store-lock'
import {
  cancelOrder,
  confirmOrder,
  dispatchOrder,
  getCancellationReasons,
  readyToPickupOrder,
  startPreparationOrder,
} from '../../shared/ifood/ifood.service'

// ─── Ações de volta: status local (Kanban) → iFood ────────────────────────────
// Quando o LOJISTA muda o status de um pedido iFood no painel, reflete no iFood.
// NÃO é chamado quando o status muda por causa de um evento vindo do iFood (o
// ingest.service atualiza direto, sem passar por updateOrderStatus) — evita eco.

function isAlreadyError(err: unknown): boolean {
  const msg = isAxiosError(err)
    ? JSON.stringify(err.response?.data ?? '')
    : (err as Error)?.message ?? ''
  return /already|CONFIRMED|DISPATCHED|not allowed|invalid.*state/i.test(msg)
}

/**
 * Reflete a mudança de status de um pedido iFood no iFood. Fire-and-forget (chamado
 * com setImmediate pelo updateOrderStatus). Idempotente: se o iFood já está no estado
 * (erro "already"), trata como sucesso. Serializado por loja.
 */
export async function reflectStatusToIFood(
  storeId: string,
  orderId: string,
  newStatus: string
): Promise<void> {
  // Só age se o pedido veio do iFood. Precisa do type pra escolher dispatch vs readyToPickup.
  const map = await prisma.iFoodOrderMap.findUnique({
    where: { orderId },
    select: { ifoodOrderId: true, storeId: true, order: { select: { type: true } } },
  })
  if (!map || map.storeId !== storeId) return

  const ifoodOrderId = map.ifoodOrderId
  const isPickup = map.order?.type === 'PICKUP'

  await withStoreLock(storeId, async () => {
    try {
      switch (newStatus) {
        case 'CONFIRMED':
          await confirmOrder(ifoodOrderId)
          break
        case 'PREPARING':
          // Opcional na doc iFood, mas recomendado — o cliente vê "em preparo" no app.
          await startPreparationOrder(ifoodOrderId)
          break
        case 'READY':
          // Coluna "Saiu pra entrega" pra RETIRADA → readyToPickup (obrigatório takeout).
          // Pra DELIVERY, READY não tem ação (o dispatch é quem avisa "saiu").
          if (isPickup) await readyToPickupOrder(ifoodOrderId)
          else return
          break
        case 'DISPATCHED':
          // Só DELIVERY despacha; retirada usa readyToPickup (tratado em READY).
          if (isPickup) return
          await dispatchOrder(ifoodOrderId)
          break
        case 'CANCELLED': {
          // Precisa de um código de motivo válido pro pedido.
          const reasons = await getCancellationReasons(ifoodOrderId)
          const reason = reasons[0]
          if (reason) {
            await cancelOrder(ifoodOrderId, reason.cancelCodeId, reason.description)
          } else {
            logger.warn({ ifoodOrderId }, 'ifood: sem cancellationReasons — cancelamento não refletido')
          }
          break
        }
        // DELIVERED não tem ação direta (o iFood conclui sozinho após dispatch).
        default:
          return
      }
      logger.info({ storeId, ifoodOrderId, newStatus }, 'ifood: status refletido')
    } catch (err) {
      if (isAlreadyError(err)) {
        logger.info({ ifoodOrderId, newStatus }, 'ifood: já estava no estado (idempotente)')
        return
      }
      logger.error({ err, ifoodOrderId, newStatus }, 'ifood: falha ao refletir status')
    }
  })
}
