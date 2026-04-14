import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type ClientSeed = {
  whatsapp: string
  name: string
  orders: { daysAgo: number; qty: number; productIdx: number }[]
}

const CLIENTS: ClientSeed[] = [
  {
    whatsapp: '5511911111111',
    name: 'Ana Silva',
    orders: [
      { daysAgo: 1, qty: 3, productIdx: 0 },
      { daysAgo: 3, qty: 4, productIdx: 1 },
      { daysAgo: 7, qty: 2, productIdx: 2 },
      { daysAgo: 12, qty: 3, productIdx: 0 },
      { daysAgo: 18, qty: 4, productIdx: 1 },
      { daysAgo: 25, qty: 2, productIdx: 2 },
    ],
  },
  {
    whatsapp: '5511922222222',
    name: 'Bruno Costa',
    orders: [
      { daysAgo: 2, qty: 2, productIdx: 1 },
      { daysAgo: 6, qty: 3, productIdx: 0 },
      { daysAgo: 10, qty: 2, productIdx: 2 },
      { daysAgo: 15, qty: 3, productIdx: 1 },
      { daysAgo: 22, qty: 2, productIdx: 0 },
    ],
  },
  {
    whatsapp: '5511933333333',
    name: 'Carla Souza',
    orders: [
      { daysAgo: 1, qty: 2, productIdx: 2 },
      { daysAgo: 5, qty: 2, productIdx: 1 },
      { daysAgo: 14, qty: 3, productIdx: 0 },
      { daysAgo: 20, qty: 2, productIdx: 2 },
    ],
  },
  {
    whatsapp: '5511944444444',
    name: 'Diego Lima',
    orders: [
      { daysAgo: 4, qty: 2, productIdx: 0 },
      { daysAgo: 11, qty: 1, productIdx: 1 },
      { daysAgo: 19, qty: 2, productIdx: 2 },
    ],
  },
  {
    whatsapp: '5511955555555',
    name: 'Elena Martins',
    orders: [
      { daysAgo: 2, qty: 1, productIdx: 1 },
      { daysAgo: 9, qty: 2, productIdx: 2 },
      { daysAgo: 17, qty: 1, productIdx: 0 },
    ],
  },
  {
    whatsapp: '5511966666666',
    name: 'Fábio Santos',
    orders: [
      { daysAgo: 6, qty: 1, productIdx: 2 },
      { daysAgo: 16, qty: 2, productIdx: 1 },
    ],
  },
  {
    whatsapp: '5511977777777',
    name: 'Gabriela Pereira',
    orders: [
      { daysAgo: 8, qty: 1, productIdx: 0 },
      { daysAgo: 21, qty: 1, productIdx: 1 },
    ],
  },
  {
    whatsapp: '5511988888888',
    name: 'Hugo Oliveira',
    orders: [{ daysAgo: 13, qty: 1, productIdx: 2 }],
  },
]

async function main() {
  const store = await prisma.store.findFirst({
    where: { slug: 'pizzariadonamaria' },
    include: { products: { where: { isActive: true, basePrice: { not: null } }, take: 3 } },
  })

  if (!store || store.products.length === 0) {
    throw new Error('Loja donamaria ou produtos não encontrados. Rode o seed principal antes.')
  }

  const whatsapps = CLIENTS.map((c) => c.whatsapp)
  const previous = await prisma.order.findMany({
    where: { storeId: store.id, clientWhatsapp: { in: whatsapps } },
    select: { id: true },
  })
  if (previous.length > 0) {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: previous.map((p) => p.id) } } })
    await prisma.order.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } })
    console.log(`🧹 Removidos ${previous.length} pedidos A-008 anteriores`)
  }

  const lastOrder = await prisma.order.findFirst({
    where: { storeId: store.id },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  let nextNumber = (lastOrder?.number ?? 0) + 1

  let totalCreated = 0

  for (const client of CLIENTS) {
    let clientSpent = 0
    for (const order of client.orders) {
      const product = store.products[order.productIdx % store.products.length]
      const unitPrice = product.basePrice ?? 0
      const subtotal = unitPrice * order.qty

      const createdAt = new Date()
      createdAt.setDate(createdAt.getDate() - order.daysAgo)
      createdAt.setHours(12 + (order.productIdx % 8), 0, 0, 0)

      await prisma.order.create({
        data: {
          storeId: store.id,
          number: nextNumber++,
          clientWhatsapp: client.whatsapp,
          clientName: client.name,
          type: 'DELIVERY',
          status: 'DELIVERED',
          paymentMethod: 'PIX',
          subtotal,
          total: subtotal,
          createdAt,
          deliveredAt: createdAt,
          items: {
            create: {
              productId: product.id,
              productName: product.name,
              quantity: order.qty,
              unitPrice,
              totalPrice: subtotal,
            },
          },
        },
      })

      clientSpent += subtotal
      totalCreated++
    }
    console.log(
      `✓ ${client.name.padEnd(20)} — ${client.orders.length} pedidos — R$ ${clientSpent.toFixed(2)}`
    )
  }

  console.log(`\n📊 Total: ${CLIENTS.length} clientes, ${totalCreated} pedidos`)
  console.log(`\n⚠️  Cache de analytics: TTL 1 min no ranking. Aguarde ou FLUSHDB no Redis.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
