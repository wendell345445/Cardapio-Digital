import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TEST_WHATSAPP = '5511988887777'

async function main() {
  const store = await prisma.store.findFirst({
    where: { slug: 'pizzariadonamaria' },
    include: { products: { where: { isActive: true, basePrice: { not: null } }, take: 3 } },
  })

  if (!store || store.products.length === 0) {
    throw new Error('Loja donamaria ou produtos não encontrados. Rode o seed principal antes.')
  }

  const previous = await prisma.order.findMany({
    where: { storeId: store.id, clientWhatsapp: TEST_WHATSAPP },
    select: { id: true },
  })
  if (previous.length > 0) {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: previous.map((p) => p.id) } } })
    await prisma.order.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } })
    console.log(`🧹 Removidos ${previous.length} pedidos A-007 anteriores`)
  }

  const lastOrder = await prisma.order.findFirst({
    where: { storeId: store.id },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  let nextNumber = (lastOrder?.number ?? 0) + 1

  // 8 hoje + 3 ontem — status DELIVERED pra contar como pedido válido no dashboard
  const scenarios = [
    { daysAgo: 0, hour: 11, qty: 1, productIdx: 0 },
    { daysAgo: 0, hour: 12, qty: 2, productIdx: 1 },
    { daysAgo: 0, hour: 13, qty: 1, productIdx: 2 },
    { daysAgo: 0, hour: 14, qty: 3, productIdx: 0 },
    { daysAgo: 0, hour: 18, qty: 2, productIdx: 1 },
    { daysAgo: 0, hour: 19, qty: 1, productIdx: 2 },
    { daysAgo: 0, hour: 20, qty: 4, productIdx: 0 },
    { daysAgo: 0, hour: 21, qty: 2, productIdx: 1 },
    { daysAgo: 1, hour: 12, qty: 1, productIdx: 0 },
    { daysAgo: 1, hour: 19, qty: 2, productIdx: 1 },
    { daysAgo: 1, hour: 20, qty: 3, productIdx: 2 },
  ]

  for (const s of scenarios) {
    const product = store.products[s.productIdx % store.products.length]
    const unitPrice = product.basePrice ?? 0
    const subtotal = unitPrice * s.qty
    const total = subtotal

    const createdAt = new Date()
    createdAt.setDate(createdAt.getDate() - s.daysAgo)
    createdAt.setHours(s.hour, 0, 0, 0)

    await prisma.order.create({
      data: {
        storeId: store.id,
        number: nextNumber++,
        clientWhatsapp: TEST_WHATSAPP,
        clientName: 'Cliente A-007',
        type: 'DELIVERY',
        status: 'DELIVERED',
        paymentMethod: 'PIX',
        subtotal,
        total,
        createdAt,
        deliveredAt: createdAt,
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            quantity: s.qty,
            unitPrice,
            totalPrice: subtotal,
          },
        },
      },
    })

    console.log(
      `✓ Pedido #${nextNumber - 1} (-${s.daysAgo}d ${s.hour}h) — ${product.name} x${s.qty} = R$ ${total.toFixed(2)}`
    )
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  const today = await prisma.order.aggregate({
    where: {
      storeId: store.id,
      createdAt: { gte: todayStart },
      status: { notIn: ['CANCELLED', 'PENDING', 'WAITING_PAYMENT_PROOF'] },
    },
    _count: true,
    _sum: { total: true },
  })
  const yesterday = await prisma.order.aggregate({
    where: {
      storeId: store.id,
      createdAt: { gte: yesterdayStart, lt: todayStart },
      status: { notIn: ['CANCELLED', 'PENDING', 'WAITING_PAYMENT_PROOF'] },
    },
    _count: true,
    _sum: { total: true },
  })

  console.log(`\n📊 Hoje: ${today._count} pedidos — R$ ${today._sum.total?.toFixed(2) ?? '0.00'}`)
  console.log(`📊 Ontem: ${yesterday._count} pedidos — R$ ${yesterday._sum.total?.toFixed(2) ?? '0.00'}`)
  console.log(
    `\n⚠️  Cache de analytics tem TTL de 10 min. Pra ver agora: FLUSHDB no Redis ou aguardar.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
