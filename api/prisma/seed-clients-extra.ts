import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 25 clientes adicionais pra testar paginação (PAGE_SIZE=10)
const CLIENTS = [
  { name: 'Isabela Rocha', ws: '5511900010001', orderCount: 4 },
  { name: 'João Fernandes', ws: '5511900010002', orderCount: 3 },
  { name: 'Kátia Almeida', ws: '5511900010003', orderCount: 5 },
  { name: 'Lucas Moreira', ws: '5511900010004', orderCount: 2 },
  { name: 'Mariana Duarte', ws: '5511900010005', orderCount: 3 },
  { name: 'Nicolas Barbosa', ws: '5511900010006', orderCount: 1 },
  { name: 'Olivia Ramos', ws: '5511900010007', orderCount: 4 },
  { name: 'Paulo Henrique', ws: '5511900010008', orderCount: 2 },
  { name: 'Quésia Nunes', ws: '5511900010009', orderCount: 3 },
  { name: 'Rafael Campos', ws: '5511900010010', orderCount: 1 },
  { name: 'Sofia Teixeira', ws: '5511900010011', orderCount: 5 },
  { name: 'Thiago Melo', ws: '5511900010012', orderCount: 2 },
  { name: 'Úrsula Pinto', ws: '5511900010013', orderCount: 1 },
  { name: 'Vitor Cardoso', ws: '5511900010014', orderCount: 3 },
  { name: 'Wanessa Lopes', ws: '5511900010015', orderCount: 2 },
  { name: 'Xavier Reis', ws: '5511900010016', orderCount: 1 },
  { name: 'Yasmin Farias', ws: '5511900010017', orderCount: 4 },
  { name: 'Zeca Mendonça', ws: '5511900010018', orderCount: 2 },
  { name: 'Amanda Siqueira', ws: '5511900010019', orderCount: 1 },
  { name: 'Bernardo Queiroz', ws: '5511900010020', orderCount: 3 },
  { name: 'Camila Vasconcelos', ws: '5511900010021', orderCount: 2 },
  { name: 'Danilo Prado', ws: '5511900010022', orderCount: 1 },
  { name: 'Eduarda Coelho', ws: '5511900010023', orderCount: 2 },
  { name: 'Fernando Galvão', ws: '5511900010024', orderCount: 1 },
  { name: 'Giovanna Peixoto', ws: '5511900010025', orderCount: 1 },
]

function sampleAddress(seed: number) {
  const streets = ['Rua das Flores', 'Av. Paulista', 'Rua Augusta', 'Av. Brasil', 'Rua do Sol']
  const neighborhoods = ['Centro', 'Jardins', 'Vila Mariana', 'Pinheiros', 'Moema']
  return {
    street: streets[seed % streets.length],
    number: String(100 + (seed * 7) % 900),
    complement: seed % 3 === 0 ? `Apto ${seed % 200 + 1}` : '',
    neighborhood: neighborhoods[seed % neighborhoods.length],
    city: 'São Paulo',
    reference: seed % 4 === 0 ? 'Próximo ao mercado' : '',
  }
}

async function main() {
  const store = await prisma.store.findFirst({
    where: { slug: 'pizzariadonamaria' },
    include: { products: { where: { isActive: true, basePrice: { not: null } }, take: 3 } },
  })

  if (!store || store.products.length === 0) {
    throw new Error('Loja donamaria ou produtos não encontrados.')
  }

  const whatsapps = CLIENTS.map((c) => c.ws)
  const previous = await prisma.order.findMany({
    where: { storeId: store.id, clientWhatsapp: { in: whatsapps } },
    select: { id: true },
  })
  if (previous.length > 0) {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: previous.map((p) => p.id) } } })
    await prisma.order.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } })
    console.log(`🧹 Removidos ${previous.length} pedidos extras anteriores`)
  }

  const lastOrder = await prisma.order.findFirst({
    where: { storeId: store.id },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  let nextNumber = (lastOrder?.number ?? 0) + 1
  let totalCreated = 0

  for (let idx = 0; idx < CLIENTS.length; idx++) {
    const client = CLIENTS[idx]
    const address = sampleAddress(idx)
    let spent = 0

    for (let i = 0; i < client.orderCount; i++) {
      const product = store.products[(idx + i) % store.products.length]
      const qty = ((idx + i) % 3) + 1
      const unitPrice = product.basePrice ?? 0
      const subtotal = unitPrice * qty

      const daysAgo = (i * 5 + (idx % 4) + 1) % 28
      const createdAt = new Date()
      createdAt.setDate(createdAt.getDate() - daysAgo)
      createdAt.setHours(12 + (i % 8), 30, 0, 0)

      await prisma.order.create({
        data: {
          storeId: store.id,
          number: nextNumber++,
          clientWhatsapp: client.ws,
          clientName: client.name,
          type: 'DELIVERY',
          status: 'DELIVERED',
          paymentMethod: 'PIX',
          subtotal,
          total: subtotal,
          address,
          createdAt,
          deliveredAt: createdAt,
          items: {
            create: {
              productId: product.id,
              productName: product.name,
              quantity: qty,
              unitPrice,
              totalPrice: subtotal,
            },
          },
        },
      })
      spent += subtotal
      totalCreated++
    }
    console.log(`✓ ${client.name.padEnd(22)} — ${client.orderCount} pedidos — R$ ${spent.toFixed(2)}`)
  }

  console.log(`\n📊 Total: ${CLIENTS.length} clientes adicionais, ${totalCreated} pedidos`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
