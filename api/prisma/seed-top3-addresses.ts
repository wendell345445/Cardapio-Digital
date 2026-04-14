import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ADDRESSES = [
  {
    street: 'Rua Oscar Freire',
    number: '1200',
    complement: 'Apto 802',
    neighborhood: 'Jardins',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01426-001',
    reference: 'Prédio azul, ao lado da padaria Bella Paulista',
  },
  {
    street: 'Av. Brigadeiro Faria Lima',
    number: '3477',
    complement: 'Torre B, sala 1501',
    neighborhood: 'Itaim Bibi',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '04538-133',
    reference: 'Edifício Pátio Malzoni, portaria principal',
  },
  {
    street: 'Rua Haddock Lobo',
    number: '595',
    complement: 'Casa 2',
    neighborhood: 'Cerqueira César',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01414-001',
    reference: 'Portão verde, interfone 12',
  },
]

async function main() {
  const store = await prisma.store.findFirst({
    where: { slug: 'pizzariadonamaria' },
    select: { id: true, name: true },
  })
  if (!store) throw new Error('Loja pizzariadonamaria não encontrada')

  const orders = await prisma.order.findMany({
    where: {
      storeId: store.id,
      status: { notIn: ['CANCELLED', 'PENDING', 'WAITING_PAYMENT_PROOF'] },
    },
    select: { clientWhatsapp: true, clientName: true, total: true, createdAt: true, id: true },
  })

  const aggregate: Record<
    string,
    { whatsapp: string; name: string | null; total: number; latestOrderId: string; latestAt: Date }
  > = {}

  for (const o of orders) {
    const key = o.clientWhatsapp
    if (!aggregate[key]) {
      aggregate[key] = {
        whatsapp: key,
        name: o.clientName,
        total: 0,
        latestOrderId: o.id,
        latestAt: o.createdAt,
      }
    }
    aggregate[key].total += o.total
    if (o.createdAt > aggregate[key].latestAt) {
      aggregate[key].latestAt = o.createdAt
      aggregate[key].latestOrderId = o.id
    }
  }

  const top3 = Object.values(aggregate)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)

  console.log('🏆 Top 3 por valor gasto:\n')
  for (let i = 0; i < top3.length; i++) {
    const client = top3[i]
    const address = ADDRESSES[i]
    await prisma.order.update({
      where: { id: client.latestOrderId },
      data: { address },
    })
    console.log(
      `  ${i + 1}. ${client.name ?? '(sem nome)'.padEnd(20)} — R$ ${client.total.toFixed(2)}`
    )
    console.log(
      `     📍 ${address.street}, ${address.number} — ${address.complement} — ${address.neighborhood}, ${address.city}/${address.state}`
    )
  }

  console.log('\n✅ Endereços completos aplicados ao pedido mais recente de cada um.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
