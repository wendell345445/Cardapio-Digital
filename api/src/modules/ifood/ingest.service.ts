import { linkOrderToCashFlow } from '../admin/cashflow.service'
import { autoPrintOrder } from '../admin/print.service'
import { asaasLogger } from '../../shared/logger/logger'
import { prisma } from '../../shared/prisma/prisma'
import { emit } from '../../shared/socket/socket'
import { withStoreLock } from '../../shared/utils/store-lock'
import { getOrder, type IFoodEvent, type IFoodOrder } from '../../shared/ifood/ifood.service'

import { reflectStatusToIFood } from './actions.service'

// ─── Ingestão de pedidos iFood → Order local ──────────────────────────────────
// Robustez: dedup em 2 camadas (IFoodEventLog.eventId + IFoodOrderMap.ifoodOrderId),
// serialização por loja (withStoreLock) e mapeamento defensivo (a loja de teste vem
// sem produtos e o shape de itens/opções varia).

type LocalStatus =
  | 'WAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED'

// fullCode do evento iFood → status local (PLACED é tratado à parte: cria o pedido).
const STATUS_MAP: Record<string, LocalStatus | undefined> = {
  CONFIRMED: 'CONFIRMED',
  DISPATCHED: 'DISPATCHED',
  READY_TO_PICKUP: 'READY',
  CONCLUDED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
}

function eventCode(event: IFoodEvent): string {
  return (event.fullCode ?? event.code ?? '').toUpperCase()
}

// ─── Mapper (puro) iFood order → dados do Order local ─────────────────────────

interface MappedOrder {
  type: 'DELIVERY' | 'PICKUP'
  deliveredBy: string | null // iFood: 'MERCHANT' | 'IFOOD' (só DELIVERY)
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  clientName: string
  address: Record<string, unknown> | null
  notes: string
  items: {
    quantity: number
    unitPrice: number
    totalPrice: number
    productName: string
    notes: string | null
    additionals: { name: string; price: number }[]
  }[]
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : fallback
}

export function mapIFoodOrder(o: IFoodOrder): MappedOrder {
  const total = o.total as Record<string, unknown> | undefined
  const deliveryFee = num(total?.deliveryFee)
  const orderAmount = num(total?.orderAmount)
  const subTotal = num(total?.subTotal, Math.max(0, orderAmount - deliveryFee))

  const type = (o.orderType || '').toUpperCase() === 'TAKEOUT' ? 'PICKUP' : 'DELIVERY'

  // Quem faz a entrega: 'MERCHANT' (loja despacha) ou 'IFOOD' (logística iFood). Decide
  // se o "saiu pra entrega" é ação nossa (dispatch) ou reflexo passivo do evento iFood.
  const deliveredByRaw = (o.delivery as { deliveredBy?: string } | undefined)?.deliveredBy
  const deliveredBy =
    type === 'DELIVERY' && typeof deliveredByRaw === 'string' ? deliveredByRaw.toUpperCase() : null

  // Endereço de entrega (só DELIVERY). Shape defensivo.
  let address: Record<string, unknown> | null = null
  if (type === 'DELIVERY') {
    const d = (o.delivery as { deliveryAddress?: Record<string, unknown> } | undefined)?.deliveryAddress
    if (d) {
      address = {
        street: d.streetName ?? d.street ?? null,
        number: d.streetNumber ?? d.number ?? null,
        complement: d.complement ?? null,
        neighborhood: d.neighborhood ?? null,
        city: d.city ?? null,
        state: d.state ?? null,
        zipCode: d.postalCode ?? null,
        reference: d.reference ?? null,
        latitude: (d.coordinates as { latitude?: number } | undefined)?.latitude ?? d.latitude ?? null,
        longitude: (d.coordinates as { longitude?: number } | undefined)?.longitude ?? d.longitude ?? null,
      }
    }
  }

  const cust = o.customer as { name?: string; phone?: { localizer?: string; number?: string } } | undefined
  const localizer = cust?.phone?.localizer ? `Tel iFood: ${cust.phone.localizer}` : ''
  const notes = [`[iFood #${o.displayId ?? o.id}]`, localizer].filter(Boolean).join(' ')

  const rawItems = Array.isArray(o.items) ? o.items : []
  const items = rawItems.map((raw) => {
    const it = raw as Record<string, unknown>
    const quantity = num(it.quantity, 1)
    const unitPrice = num(it.unitPrice, num(it.price, quantity ? num(it.totalPrice) / quantity : 0))
    const totalPrice = num(it.totalPrice, unitPrice * quantity)
    // Opções: `options` flat OU dentro de `optionGroups[].options` (o shape varia).
    const flatOptions = Array.isArray(it.options) ? (it.options as Record<string, unknown>[]) : []
    const groupOptions = Array.isArray(it.optionGroups)
      ? (it.optionGroups as { options?: Record<string, unknown>[] }[]).flatMap((g) => g.options ?? [])
      : []
    const additionals = [...flatOptions, ...groupOptions].map((op) => ({
      name: String(op.name ?? 'Adicional'),
      price: num(op.price),
    }))
    return {
      quantity,
      unitPrice,
      totalPrice,
      productName: String(it.name ?? 'Item iFood'),
      notes: (it.observations as string) ?? null,
      additionals,
    }
  })

  return {
    type,
    deliveredBy,
    subtotal: subTotal,
    deliveryFee,
    discount: 0,
    total: orderAmount,
    clientName: cust?.name || 'Cliente iFood',
    address,
    notes,
    items,
  }
}

// ─── Criação/atualização do Order local ───────────────────────────────────────

/** Cria o Order local a partir de um pedido iFood (evento PLACED). Idempotente por ifoodOrderId. */
async function createLocalOrder(
  store: { id: string; autoConfirmOrders: boolean },
  ifoodOrder: IFoodOrder
): Promise<void> {
  // Já existe mapeamento? (evento PLACED duplicado) → no-op.
  const existing = await prisma.iFoodOrderMap.findUnique({
    where: { storeId_ifoodOrderId: { storeId: store.id, ifoodOrderId: ifoodOrder.id } },
  })
  if (existing) return

  const m = mapIFoodOrder(ifoodOrder)
  const status = store.autoConfirmOrders ? 'CONFIRMED' : 'WAITING_CONFIRMATION'

  const last = await prisma.order.findFirst({ where: { storeId: store.id }, orderBy: { number: 'desc' } })
  const number = (last?.number ?? 0) + 1

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        storeId: store.id,
        number,
        type: m.type,
        status,
        // Pedido iFood já foi pago na plataforma — marca pago pra não travar o gate de DELIVERED.
        paymentMethod: 'IFOOD',
        paymentReceivedAt: new Date(),
        confirmedAt: status === 'CONFIRMED' ? new Date() : null,
        clientName: m.clientName,
        clientWhatsapp: null, // phone do iFood é localizador ofuscado, não WhatsApp real
        ifoodDeliveredBy: m.deliveredBy,
        deliveryFee: m.deliveryFee,
        subtotal: m.subtotal,
        discount: m.discount,
        total: m.total,
        address: (m.address ?? undefined) as object | undefined,
        notes: m.notes,
        notifyOnStatusChange: false,
        items: {
          create: m.items.map((it) => ({
            productId: null,
            variationId: null,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.totalPrice,
            productName: it.productName,
            variationName: null,
            notes: it.notes,
            additionals: { create: it.additionals },
          })),
        },
      },
      include: { items: { include: { additionals: true } } },
    })
    await tx.iFoodOrderMap.create({
      data: { storeId: store.id, ifoodOrderId: ifoodOrder.id, orderId: created.id },
    })
    return created
  })

  // Cashflow (idempotente) + push pro painel.
  await linkOrderToCashFlow(store.id, order.id).catch((err) =>
    asaasLogger.error({ err, orderId: order.id }, 'ifood: linkOrderToCashFlow failed')
  )
  emit.orderNew(store.id, order)
  emit.orderUpdated(store.id, order)

  // Auto-confirm ON: o pedido nasceu CONFIRMED SEM passar por updateOrderStatus, então
  // os side-effects de confirmação não dispararam. Replica aqui os mesmos do
  // updateOrderStatus(→CONFIRMED): (1) reflete `confirmOrder` pro iFood — CRÍTICO, senão
  // o iFood cancela o pedido por falta de confirmação no prazo (≤8min); (2) auto-print.
  // Fire-and-forget (setImmediate + .catch) pra nunca derrubar a ingestão.
  if (status === 'CONFIRMED') {
    setImmediate(() =>
      reflectStatusToIFood(store.id, order.id, 'CONFIRMED').catch((err) =>
        asaasLogger.error({ err, orderId: order.id }, 'ifood: reflect CONFIRMED on auto-confirm failed')
      )
    )
    setImmediate(() =>
      autoPrintOrder(order.id).catch((err) =>
        asaasLogger.error({ err, orderId: order.id }, 'ifood: autoPrint on auto-confirm failed')
      )
    )
  }

  asaasLogger.info({ storeId: store.id, orderId: order.id, ifoodOrderId: ifoodOrder.id }, 'ifood order created')
}

/** Marca que o pedido exige código de entrega (evento DELIVERY_DROP_CODE_REQUESTED). */
async function markRequiresDeliveryCode(storeId: string, ifoodOrderId: string): Promise<void> {
  const map = await prisma.iFoodOrderMap.findUnique({
    where: { storeId_ifoodOrderId: { storeId, ifoodOrderId } },
    select: { orderId: true },
  })
  if (!map) return
  await prisma.order.update({
    where: { id: map.orderId },
    data: { ifoodRequiresDeliveryCode: true },
  })
  asaasLogger.info({ storeId, ifoodOrderId }, 'ifood: pedido exige código de entrega')
}

/** Atualiza o status do Order local a partir de um evento iFood (CONFIRMED/DISPATCHED/etc). */
async function updateLocalStatus(storeId: string, ifoodOrderId: string, newStatus: LocalStatus): Promise<void> {
  const map = await prisma.iFoodOrderMap.findUnique({
    where: { storeId_ifoodOrderId: { storeId, ifoodOrderId } },
    include: {
      order: {
        select: { id: true, status: true, ifoodDeliveredBy: true, motoboyId: true, externalCourierName: true },
      },
    },
  })
  if (!map) return // pedido ainda não criado localmente (evento fora de ordem) — o PLACED cria depois

  // Estados terminais locais não regridem.
  if (map.order.status === 'DELIVERED' || map.order.status === 'CANCELLED') return
  if (map.order.status === newStatus) return

  const now = new Date()
  const stamps: Record<string, Date | string> = {}
  if (newStatus === 'CONFIRMED') stamps.confirmedAt = now
  if (newStatus === 'DISPATCHED') stamps.dispatchedAt = now
  if (newStatus === 'DELIVERED') stamps.deliveredAt = now
  if (newStatus === 'CANCELLED') stamps.cancelledAt = now

  // Logística iFood: quando o entregador do iFood coleta (DISPATCHED vindo do iFood),
  // registra "iFood Motoboy" como entregador — não há motoboy da loja e dá visibilidade
  // pro operador. Só se ainda não houver entregador definido.
  if (
    newStatus === 'DISPATCHED' &&
    map.order.ifoodDeliveredBy === 'IFOOD' &&
    !map.order.motoboyId &&
    !map.order.externalCourierName
  ) {
    stamps.externalCourierName = 'iFood Motoboy'
  }

  const updated = await prisma.order.update({
    where: { id: map.order.id },
    // A mudança veio DO iFood — updateOrderStatus não é chamado aqui, então não há eco
    // de volta. (A ação de volta só sai quando o LOJISTA muda no Kanban.)
    data: { status: newStatus, ...stamps },
    include: { items: { include: { additionals: true } } },
  })
  emit.orderUpdated(storeId, updated)
  asaasLogger.info({ storeId, ifoodOrderId, newStatus }, 'ifood order status updated')
}

// ─── Processador de evento (dedup + lock por loja) ────────────────────────────

/**
 * Processa um evento iFood. Idempotente e serializado por loja:
 *  - Camada 1: IFoodEventLog(eventId) — se já processado, no-op.
 *  - Camada 2: IFoodOrderMap(ifoodOrderId) — PLACED duplicado não recria o pedido.
 */
export async function processIFoodEvent(
  store: { id: string; autoConfirmOrders: boolean },
  event: IFoodEvent
): Promise<void> {
  await withStoreLock(store.id, async () => {
    // Camada 1 — dedup por eventId.
    const already = await prisma.iFoodEventLog.findUnique({
      where: { storeId_eventId: { storeId: store.id, eventId: event.id } },
    })
    if (already?.processedAt) return

    await prisma.iFoodEventLog.upsert({
      where: { storeId_eventId: { storeId: store.id, eventId: event.id } },
      create: {
        storeId: store.id,
        eventId: event.id,
        eventType: eventCode(event),
        orderId: event.orderId,
        payload: event as unknown as object,
      },
      update: {},
    })

    const code = eventCode(event)
    try {
      if (code === 'PLACED') {
        const ifoodOrder = await getOrder(event.orderId)
        await createLocalOrder(store, ifoodOrder)
      } else if (code === 'DELIVERY_DROP_CODE_REQUESTED') {
        // Pedido exige código de entrega — marca pra o painel mostrar o campo.
        await markRequiresDeliveryCode(store.id, event.orderId)
      } else {
        const localStatus = STATUS_MAP[code]
        if (localStatus) await updateLocalStatus(store.id, event.orderId, localStatus)
        // códigos não mapeados (SEPARATION_*, HANDSHAKE, etc.) → ignorados de propósito
      }
      await prisma.iFoodEventLog.update({
        where: { storeId_eventId: { storeId: store.id, eventId: event.id } },
        data: { processedAt: new Date() },
      })
    } catch (err) {
      // Não marca processedAt → o evento volta no próximo poll (retry). Loga e segue.
      asaasLogger.error({ err, storeId: store.id, eventId: event.id, code }, 'ifood event processing failed')
    }
  })
}
