import { isAxiosError } from 'axios'

import { logger } from '../../shared/logger/logger'
import { prisma } from '../../shared/prisma/prisma'
import { withStoreLock } from '../../shared/utils/store-lock'
import {
  cancelOrder,
  confirmOrder,
  dispatchOrder,
  getCancellationReasons,
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
  // Só age se o pedido veio do iFood.
  const map = await prisma.iFoodOrderMap.findUnique({
    where: { orderId },
    select: { ifoodOrderId: true, storeId: true },
  })
  if (!map || map.storeId !== storeId) return

  const ifoodOrderId = map.ifoodOrderId

  await withStoreLock(storeId, async () => {
    try {
      switch (newStatus) {
        case 'CONFIRMED':
          await confirmOrder(ifoodOrderId)
          break
        case 'DISPATCHED':
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
        // PREPARING/READY/DELIVERED não têm ação direta no iFood (confirm→dispatch cobre o fluxo).
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
