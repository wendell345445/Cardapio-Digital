import { isAxiosError } from 'axios'

import { logger } from '../../shared/logger/logger'
import { prisma } from '../../shared/prisma/prisma'
import { withStoreLock } from '../../shared/utils/store-lock'
import { AppError } from '../../shared/middleware/error.middleware'
import {
  arrivedAtDestinationOrder,
  cancelOrder,
  confirmOrder,
  dispatchOrder,
  getCancellationReasons,
  readyToPickupOrder,
  verifyDeliveryCode,
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
  // Só age se o pedido veio do iFood. Precisa de type + deliveredBy pra ramificar.
  const map = await prisma.iFoodOrderMap.findUnique({
    where: { orderId },
    select: {
      ifoodOrderId: true,
      storeId: true,
      order: { select: { type: true, ifoodDeliveredBy: true } },
    },
  })
  if (!map || map.storeId !== storeId) return

  const ifoodOrderId = map.ifoodOrderId
  const isPickup = map.order?.type === 'PICKUP'
  // Entrega própria da loja (MERCHANT) → a loja despacha. Logística iFood (IFOOD) → o
  // iFood despacha sozinho quando o entregador coleta (não chamamos dispatch). NULL
  // (pedido antigo sem o dado) → trata como MERCHANT (comportamento anterior, conservador).
  const isMerchantDelivery = map.order?.ifoodDeliveredBy !== 'IFOOD'

  await withStoreLock(storeId, async () => {
    try {
      switch (newStatus) {
        case 'CONFIRMED':
          await confirmOrder(ifoodOrderId)
          break
        // PREPARING (Em preparo) é controle INTERNO do Menu Panda ("foi pra cozinha") —
        // NÃO reflete pro iFood (a confirmação já avisou o cliente).
        case 'READY':
          // Card entra em "Pronto / Saiu para entregar" → marca PRONTO no iFood
          // (readyToPickup). Serve pra RETIRADA e DELIVERY (nos dois casos sinaliza
          // que o pedido está pronto pro cliente/entregador). É idempotente.
          await readyToPickupOrder(ifoodOrderId)
          break
        case 'DISPATCHED':
          // "Saiu / em rota" (atribuir motoboy). Retirada não despacha. DELIVERY só
          // despacha se a entrega é da LOJA (MERCHANT). Se é logística iFood, o
          // dispatch vem do evento quando o entregador do iFood coleta — não chamamos.
          if (isPickup || !isMerchantDelivery) return
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
        case 'DELIVERED':
          // Concluir do nosso lado é best-effort pro iFood: avisa que o entregador
          // chegou (arrivedAtDestination). Isso destrava a conclusão. Se o pedido exige
          // código de entrega, o iFood só conclui após o código válido (validado à parte
          // via submitDeliveryCode) OU pelo automático dele. Não force verifyDeliveryCode
          // aqui — em produção não temos o código (o cliente informa ao entregador).
          // Só DELIVERY própria (MERCHANT); retirada/logística iFood não se aplica.
          if (isPickup || !isMerchantDelivery) return
          await arrivedAtDestinationOrder(ifoodOrderId)
          break
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

/**
 * Valida o código de entrega de um pedido iFood (que o cliente informou ao entregador).
 * Chamado por ação do operador no painel. Antes garante o arrivedAtDestination. Se o
 * código validar, o iFood conclui o pedido. Serializado por loja.
 */
export async function submitDeliveryCode(storeId: string, orderId: string, code: string): Promise<boolean> {
  const map = await prisma.iFoodOrderMap.findUnique({
    where: { orderId },
    select: { ifoodOrderId: true, storeId: true },
  })
  if (!map || map.storeId !== storeId) {
    throw new AppError('Pedido iFood não encontrado', 404)
  }

  return withStoreLock(storeId, async () => {
    // Garante que o iFood sabe que o entregador chegou (idempotente).
    await arrivedAtDestinationOrder(map.ifoodOrderId).catch((err) =>
      logger.warn({ err, ifoodOrderId: map.ifoodOrderId }, 'ifood: arrivedAtDestination falhou (segue)')
    )
    const valid = await verifyDeliveryCode(map.ifoodOrderId, code)
    logger.info({ storeId, ifoodOrderId: map.ifoodOrderId, valid }, 'ifood: verifyDeliveryCode')
    return valid
  })
}
