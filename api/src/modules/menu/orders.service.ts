import { sign } from 'jsonwebtoken'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'
import { emit } from '../../shared/socket/socket'
import { enqueueScheduledOrderAlert } from '../../jobs/scheduled-orders.job'
import { sendOrderCreatedMessage } from '../whatsapp/messages.service'

import { generatePix } from './pix.service'
import type { PixData } from './pix.service'
import type { CreateOrderInput } from './orders.schema'

// ─── TASK-065: Pedidos Públicos ───────────────────────────────────────────────

type StoreStatus = 'open' | 'closed' | 'suspended'

function calcStoreStatus(store: {
  status: string
  manualOpen: boolean | null
  businessHours: Array<{
    dayOfWeek: number
    openTime: string | null
    closeTime: string | null
    isClosed: boolean
  }>
}): StoreStatus {
  if (store.status === 'SUSPENDED') return 'suspended'
  if (store.manualOpen === false) return 'closed'
  if (store.manualOpen === true) return 'open'

  // UTC-3 = BRT (Brasil não tem horário de verão desde 2019)
  const now = new Date()
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const dayOfWeek = brt.getUTCDay()
  const hh = String(brt.getUTCHours()).padStart(2, '0')
  const mm = String(brt.getUTCMinutes()).padStart(2, '0')
  const currentTime = `${hh}:${mm}`

  const todayHour = store.businessHours.find((bh) => bh.dayOfWeek === dayOfWeek)

  if (!todayHour || todayHour.isClosed) return 'closed'
  if (!todayHour.openTime || !todayHour.closeTime) return 'closed'
  if (currentTime >= todayHour.openTime && currentTime <= todayHour.closeTime) return 'open'

  return 'closed'
}

export async function createOrder(slug: string, data: CreateOrderInput) {
  // 1. Busca loja por slug
  const store = await prisma.store.findUnique({
    where: { slug },
    include: { businessHours: true },
  })
  if (!store) throw new AppError('Loja não encontrada', 404)

  // 2. Valida loja aberta (agendados passam mesmo com loja fechada)
  if (!data.scheduledFor) {
    const storeStatus = calcStoreStatus(store)
    if (storeStatus === 'suspended') throw new AppError('Loja não está operando online', 422)
    if (storeStatus === 'closed') throw new AppError('Loja está fechada no momento', 422)
  }

  // 2a. TASK-092: Valida agendamento
  if (data.scheduledFor) {
    const minAdvance = new Date(Date.now() + 30 * 60 * 1000)
    if (data.scheduledFor < minAdvance) {
      throw new AppError('Agendamento requer mínimo 30 minutos de antecedência', 422)
    }
  }

  // 3. Valida tipo de entrega
  if (data.type === 'DELIVERY' && !data.address) {
    throw new AppError('Endereço é obrigatório para entrega', 422)
  }
  const isOnDeliveryPayment =
    data.paymentMethod === 'CASH_ON_DELIVERY' ||
    data.paymentMethod === 'CREDIT_ON_DELIVERY' ||
    data.paymentMethod === 'DEBIT_ON_DELIVERY' ||
    data.paymentMethod === 'PIX_ON_DELIVERY'
  if (data.type === 'DELIVERY' && !store.allowCashOnDelivery && isOnDeliveryPayment) {
    throw new AppError('Pagamento na entrega não permitido nesta loja', 422)
  }
  if (data.paymentMethod === 'CREDIT_CARD' && !store.allowCreditCard) {
    throw new AppError('Pagamento em cartão de crédito não permitido nesta loja', 422)
  }

  // 4. Valida e calcula itens
  let subtotal = 0
  const orderItemsData: Array<{
    productId: string
    variationId: string | undefined
    quantity: number
    unitPrice: number
    totalPrice: number
    notes: string | undefined
    productName: string
    variationName: string | undefined
    additionals: Array<{ name: string; price: number }>
  }> = []

  for (const item of data.items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: { variations: true, additionals: true },
    })
    if (!product || product.storeId !== store.id) {
      throw new AppError(`Produto ${item.productId} não encontrado`, 404)
    }
    if (!product.isActive) {
      throw new AppError(`Produto ${product.name} não está disponível`, 422)
    }

    let unitPrice = product.basePrice ?? 0
    let variationName: string | undefined

    if (item.variationId) {
      const variation = product.variations.find(
        (v) => v.id === item.variationId && v.isActive
      )
      if (!variation) {
        throw new AppError(`Variação não encontrada para ${product.name}`, 404)
      }
      unitPrice = variation.price
      variationName = variation.name
    }

    const additionals: Array<{ name: string; price: number }> = []
    for (const addId of item.additionalIds) {
      const add = product.additionals.find((a) => a.id === addId && a.isActive)
      if (!add) throw new AppError('Adicional não encontrado', 404)
      additionals.push({ name: add.name, price: add.price })
    }

    const addTotal = additionals.reduce((s, a) => s + a.price, 0)
    const totalPrice = (unitPrice + addTotal) * item.quantity
    subtotal += totalPrice

    orderItemsData.push({
      productId: item.productId,
      variationId: item.variationId,
      quantity: item.quantity,
      unitPrice,
      totalPrice,
      notes: item.notes,
      productName: product.name,
      variationName,
      additionals,
    })
  }

  // 5. Valida cupom (se fornecido)
  let discount = 0
  let couponId: string | undefined

  if (data.couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { storeId_code: { storeId: store.id, code: data.couponCode } },
    })
    if (!coupon || !coupon.isActive) throw new AppError('Cupom inválido ou expirado', 422)
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new AppError('Cupom expirado', 422)
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new AppError('Cupom esgotado', 422)
    }
    if (coupon.minOrder !== null && subtotal < coupon.minOrder) {
      throw new AppError(`Pedido mínimo para este cupom: R$ ${coupon.minOrder.toFixed(2)}`, 422)
    }

    discount =
      coupon.type === 'PERCENTAGE' ? subtotal * (coupon.value / 100) : coupon.value
    discount = Math.min(discount, subtotal)
    couponId = coupon.id
  }

  // 6. Taxa de entrega por bairro
  let deliveryFee = 0
  if (data.type === 'DELIVERY' && data.address) {
    const neighborhood = await prisma.deliveryNeighborhood.findFirst({
      where: {
        storeId: store.id,
        name: { equals: data.address.neighborhood, mode: 'insensitive' },
      },
    })
    if (neighborhood === null) {
      const hasNeighborhoodConfig = await prisma.deliveryNeighborhood.count({
        where: { storeId: store.id },
      })
      if (hasNeighborhoodConfig > 0) throw new AppError('Não entregamos neste bairro', 422)
    } else {
      deliveryFee = neighborhood.fee
    }
  }

  const total = subtotal - discount + deliveryFee

  // 7. Cria ou encontra cliente por WhatsApp
  let client = await prisma.user.findFirst({
    where: { whatsapp: data.clientWhatsapp, storeId: store.id },
  })
  if (!client) {
    client = await prisma.user.create({
      data: {
        whatsapp: data.clientWhatsapp,
        name: data.clientName,
        role: 'CLIENT',
        storeId: store.id,
      },
    })
  } else if (data.clientName && !client.name) {
    client = await prisma.user.update({
      where: { id: client.id },
      data: { name: data.clientName },
    })
  }

  // 8. Número sequencial por loja
  const lastOrder = await prisma.order.findFirst({
    where: { storeId: store.id },
    orderBy: { number: 'desc' },
  })
  const orderNumber = (lastOrder?.number ?? 0) + 1

  // 9. Status baseado no método de pagamento
  const status =
    data.paymentMethod === 'PIX' ? 'WAITING_PAYMENT_PROOF' : 'WAITING_CONFIRMATION'

  // 10. Cria pedido em transação
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        storeId: store.id,
        number: orderNumber,
        clientId: client!.id,
        clientWhatsapp: data.clientWhatsapp,
        clientName: data.clientName ?? client!.name,
        type: data.type,
        status,
        paymentMethod: data.paymentMethod,
        deliveryFee,
        subtotal,
        discount,
        total,
        address: data.address ?? undefined,
        notes: data.notes,
        tableId: data.tableId,
        couponId,
        scheduledFor: data.scheduledFor,
        items: {
          create: orderItemsData.map((item) => ({
            productId: item.productId,
            variationId: item.variationId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            notes: item.notes,
            productName: item.productName,
            variationName: item.variationName,
            additionals: {
              create: item.additionals,
            },
          })),
        },
      },
      include: { items: { include: { additionals: true } } },
    })

    if (couponId) {
      await tx.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      })
    }

    return created
  })

  // 11. Invalida cache do menu
  await cache.del(`menu:${store.id}`)

  // 12. Emite evento Socket.io para admin
  emit.orderNew(store.id, order)

  // TASK-092: Agenda alerta 15 min antes se pedido agendado
  if (data.scheduledFor) {
    enqueueScheduledOrderAlert(order.id, data.scheduledFor).catch(() => void 0)
  }

  // 13. WhatsApp: mensagem automática para o cliente (fire-and-forget)
  setImmediate(async () => {
    try {
      const orderWithStore = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
          items: { include: { additionals: true } },
          store: { select: { id: true, name: true, slug: true, pixKey: true, pixKeyType: true } },
        },
      })
      if (orderWithStore) {
        await sendOrderCreatedMessage({
          ...orderWithStore,
          type: orderWithStore.type as string,
          status: orderWithStore.status as string,
          paymentMethod: orderWithStore.paymentMethod as string,
          address: orderWithStore.address as Record<string, string> | null,
          store: orderWithStore.store,
        })
      }
    } catch (err) {
      console.error('[WhatsApp] Error sending order created message:', err)
    }
  })

  // 14. Gera token JWT para acompanhamento (magic link)
  const token = sign(
    { orderId: order.id, storeId: store.id },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  )

  // 15. Gera Pix QR Code (fire-and-forget seguro — não quebra o pedido se falhar)
  let pixData: PixData | undefined
  if (data.paymentMethod === 'PIX' && store.pixKey) {
    try {
      pixData = await generatePix({
        pixKey: store.pixKey,
        pixKeyType: store.pixKeyType ?? 'RANDOM',
        amount: total,
        merchantName: store.name.slice(0, 25),
        merchantCity: 'SAO PAULO',
        txid: order.number.toString(),
      })
    } catch (err) {
      console.error('[Pix] Erro ao gerar QR Code:', err)
    }
  }

  return {
    orderId: order.id,
    orderNumber: order.number,
    token,
    total: order.total,
    status: order.status,
    pixKey: data.paymentMethod === 'PIX' ? store.pixKey : undefined,
    pixKeyType: data.paymentMethod === 'PIX' ? store.pixKeyType : undefined,
    pixQrCode: pixData?.qrCodeBase64,
    pixCopyPaste: pixData?.copyPaste,
  }
}
