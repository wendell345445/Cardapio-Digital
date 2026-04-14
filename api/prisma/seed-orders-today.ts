import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const store = await prisma.store.findFirst({
    where: { slug: 'pizzariadonamaria' },
    include: { products: { where: { isActive: true, basePrice: { not: null } }, take: 3 } },
  })

  if (!store || store.products.length === 0) {
    throw new Error('Loja donamaria ou produtos não encontrados. Rode o seed principal antes.')
  }

  const previous = await prisma.order.findMany({
    where: { storeId: store.id, clientWhatsapp: '5511999999999' },
    select: { id: true },
  })
  if (previous.length > 0) {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: previous.map((p) => p.id) } } })
    await prisma.order.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } })
    console.log(`🧹 Removidos ${previous.length} pedidos de teste anteriores`)
  }

  const lastOrder = await prisma.order.findFirst({
    where: { storeId: store.id },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  let nextNumber = (lastOrder?.number ?? 0) + 1

  const scenarios = [
    { daysAgo: 0, status: 'DELIVERED' as const, qty: 2, productIdx: 0 },
    { daysAgo: 0, status: 'PREPARING' as const, qty: 1, productIdx: 1 },
    { daysAgo: 0, status: 'CONFIRMED' as const, qty: 3, productIdx: 2 },
    { daysAgo: 1, status: 'DELIVERED' as const, qty: 4, productIdx: 0 },
    { daysAgo: 1, status: 'DELIVERED' as const, qty: 2, productIdx: 2 },
    { daysAgo: 2, status: 'DELIVERED' as const, qty: 1, productIdx: 1 },
    { daysAgo: 3, status: 'DELIVERED' as const, qty: 5, productIdx: 0 },
    { daysAgo: 3, status: 'DELIVERED' as const, qty: 3, productIdx: 1 },
    { daysAgo: 4, status: 'DELIVERED' as const, qty: 2, productIdx: 2 },
    { daysAgo: 5, status: 'DELIVERED' as const, qty: 6, productIdx: 0 },
    { daysAgo: 6, status: 'DELIVERED' as const, qty: 1, productIdx: 1 },
    { daysAgo: 6, status: 'DELIVERED' as const, qty: 4, productIdx: 2 },
  ]

  for (const s of scenarios) {
    const product = store.products[s.productIdx % store.products.length]
    const unitPrice = product.basePrice ?? 0
    const subtotal = unitPrice * s.qty
    const total = subtotal
    const createdAt = new Date(Date.now() - s.daysAgo * 24 * 60 * 60 * 1000)

    await prisma.order.create({
      data: {
        storeId: store.id,
        number: nextNumber++,
        clientWhatsapp: '5511999999999',
        clientName: 'Cliente Teste',
        type: 'DELIVERY',
        status: s.status,
        paymentMethod: 'PIX',
        subtotal,
        total,
        createdAt,
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

    console.log(`✓ Pedido #${nextNumber - 1} (${s.status}, -${s.daysAgo}d) — ${product.name} x${s.qty} = R$ ${total.toFixed(2)}`)
  }

  const summary = await prisma.order.aggregate({
    where: {
      storeId: store.id,
      createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      status: { notIn: ['CANCELLED', 'PENDING', 'WAITING_PAYMENT_PROOF'] },
    },
    _count: true,
    _sum: { total: true },
  })

  console.log(`\nPedidos válidos hoje: ${summary._count}, receita: R$ ${summary._sum.total?.toFixed(2) ?? '0.00'}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
