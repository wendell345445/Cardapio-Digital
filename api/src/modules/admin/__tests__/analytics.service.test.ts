// ─── TASK-093/094: Analytics e Ranking de Clientes — Unit Tests ──────────────
// Cobre: getSalesSummary, getTopProducts, getPeakHours, getClientRanking

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    orderItem: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('../../../shared/redis/redis', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import { cache } from '../../../shared/redis/redis'
import {
  getClientDetail,
  getClientRanking,
  getPeakHours,
  getSalesSummary,
  getTopProducts,
  invalidateAnalyticsCache,
} from '../analytics.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockCache = cache as jest.Mocked<typeof cache>

const STORE_ID = 'store-1'

function makeOrder(overrides: {
  total?: number
  createdAt?: Date
  paymentMethod?: string
  clientWhatsapp?: string
  clientName?: string
}) {
  return {
    total: overrides.total ?? 100,
    createdAt: overrides.createdAt ?? new Date('2026-04-01T12:00:00.000Z'),
    paymentMethod: overrides.paymentMethod ?? 'PIX',
    clientWhatsapp: overrides.clientWhatsapp ?? '5511999990001',
    clientName: overrides.clientName ?? 'Cliente A',
    clientId: 'client-1',
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockCache.get as jest.Mock).mockResolvedValue(null) // sem cache por padrão
  ;(mockCache.set as jest.Mock).mockResolvedValue(undefined)
  ;(mockCache.del as jest.Mock).mockResolvedValue(undefined)
  ;(mockPrisma.order.count as jest.Mock).mockResolvedValue(0)
})

// ─── getSalesSummary ──────────────────────────────────────────────────────────

describe('getSalesSummary', () => {
  it('retorna total de receita, pedidos e ticket médio corretamente', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([
      makeOrder({ total: 100 }),
      makeOrder({ total: 60 }),
      makeOrder({ total: 40 }),
    ])

    const result = await getSalesSummary(STORE_ID, { period: 'day' })

    expect(result.totalRevenue).toBe(200)
    expect(result.totalOrders).toBe(3)
    expect(result.averageTicket).toBeCloseTo(66.67)
  })

  it('retorna averageTicket=0 quando não há pedidos', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    const result = await getSalesSummary(STORE_ID, { period: 'day' })

    expect(result.totalRevenue).toBe(0)
    expect(result.totalOrders).toBe(0)
    expect(result.averageTicket).toBe(0)
  })

  it('agrupa pedidos por data no timeline', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([
      makeOrder({ total: 50, createdAt: new Date('2026-04-01T10:00:00Z') }),
      makeOrder({ total: 30, createdAt: new Date('2026-04-01T15:00:00Z') }),
      makeOrder({ total: 80, createdAt: new Date('2026-04-02T10:00:00Z') }),
    ])

    const result = await getSalesSummary(STORE_ID, { period: 'week' })

    expect(result.timeline).toHaveLength(2)
    const day1 = result.timeline.find((t: { date: string }) => t.date === '2026-04-01')
    expect(day1?.revenue).toBe(80)
    expect(day1?.orders).toBe(2)
  })

  it('agrupa por data BRT (pedido às 23h BRT = 02h UTC do dia seguinte cai no mesmo dia BRT)', async () => {
    // 2026-04-13T23:00:00 BRT = 2026-04-14T02:00:00 UTC
    // Antes do fix: agrupava em "2026-04-14" (UTC). Agora: "2026-04-13" (BRT) ✅
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([
      makeOrder({ total: 100, createdAt: new Date('2026-04-13T14:00:00Z') }), // 11h BRT 13/04
      makeOrder({ total: 80, createdAt: new Date('2026-04-14T02:00:00Z') }), // 23h BRT 13/04
    ])

    const result = await getSalesSummary(STORE_ID, { period: 'week' })

    expect(result.timeline).toHaveLength(1)
    expect(result.timeline[0].date).toBe('2026-04-13')
    expect(result.timeline[0].orders).toBe(2)
    expect(result.timeline[0].revenue).toBe(180)
  })

  it('retorna dados do cache quando disponível', async () => {
    const cachedData = { totalRevenue: 999, totalOrders: 1, averageTicket: 999, timeline: [] }
    ;(mockCache.get as jest.Mock).mockResolvedValue(cachedData)

    const result = await getSalesSummary(STORE_ID, { period: 'day' })

    expect(result).toEqual(cachedData)
    expect(mockPrisma.order.findMany).not.toHaveBeenCalled()
  })

  it('salva resultado no cache após query', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([makeOrder({ total: 100 })])

    await getSalesSummary(STORE_ID, { period: 'month' })

    expect(mockCache.set).toHaveBeenCalledWith(
      `analytics:sales:${STORE_ID}:month`,
      expect.any(Object),
      600 // 10 min
    )
  })

  it('filtra pedidos cancelados e pendentes', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([makeOrder({ total: 100 })])

    await getSalesSummary(STORE_ID, { period: 'day' })

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storeId: STORE_ID,
          status: { notIn: expect.arrayContaining(['CANCELLED', 'PENDING']) },
        }),
      })
    )
  })
})

// ─── invalidateAnalyticsCache ─────────────────────────────────────────────────

describe('invalidateAnalyticsCache', () => {
  it('apaga todas as chaves de analytics da store', async () => {
    await invalidateAnalyticsCache(STORE_ID)

    expect(mockCache.del).toHaveBeenCalledWith(`analytics:sales:${STORE_ID}:day`)
    expect(mockCache.del).toHaveBeenCalledWith(`analytics:sales:${STORE_ID}:week`)
    expect(mockCache.del).toHaveBeenCalledWith(`analytics:sales:${STORE_ID}:month`)
    expect(mockCache.del).toHaveBeenCalledWith(`analytics:top-products:${STORE_ID}:day:4`)
    expect(mockCache.del).toHaveBeenCalledWith(`analytics:top-products:${STORE_ID}:week:4`)
    expect(mockCache.del).toHaveBeenCalledWith(`analytics:top-products:${STORE_ID}:month:4`)
    expect(mockCache.del).toHaveBeenCalledWith(`analytics:peak-hours:${STORE_ID}`)
  })
})

// ─── getTopProducts ───────────────────────────────────────────────────────────

describe('getTopProducts', () => {
  it('retorna top produtos ordenados por quantidade vendida', async () => {
    ;(mockPrisma.orderItem.findMany as jest.Mock).mockResolvedValue([
      { productId: 'p1', productName: 'Pizza', quantity: 5, totalPrice: 200 },
      { productId: 'p1', productName: 'Pizza', quantity: 3, totalPrice: 120 },
      { productId: 'p2', productName: 'Hamburguer', quantity: 7, totalPrice: 140 },
    ])

    const result = await getTopProducts(STORE_ID, { period: 'month', limit: 10 })

    // Pizza agrega 5+3=8 unidades, Hamburguer 7 → Pizza rank 1
    expect(result[0].productId).toBe('p1')
    expect(result[0].rank).toBe(1)
    expect(result[1].productId).toBe('p2')
    expect(result[1].rank).toBe(2)
  })

  it('agrega quantidade e receita do mesmo produto de pedidos diferentes', async () => {
    ;(mockPrisma.orderItem.findMany as jest.Mock).mockResolvedValue([
      { productId: 'p1', productName: 'Pizza', quantity: 2, totalPrice: 80 },
      { productId: 'p1', productName: 'Pizza', quantity: 3, totalPrice: 120 },
    ])

    const result = await getTopProducts(STORE_ID, { period: 'week', limit: 10 })

    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(5)
    expect(result[0].revenue).toBe(200)
  })

  it('respeita o limite de resultados', async () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      productId: `p${i}`,
      productName: `Produto ${i}`,
      quantity: 15 - i, // decrescente para garantir ordem
      totalPrice: 100,
    }))
    ;(mockPrisma.orderItem.findMany as jest.Mock).mockResolvedValue(items)

    const result = await getTopProducts(STORE_ID, { period: 'month', limit: 10 })

    expect(result).toHaveLength(10)
    expect(result[0].rank).toBe(1)
  })

  it('retorna lista vazia quando não há itens de pedido', async () => {
    ;(mockPrisma.orderItem.findMany as jest.Mock).mockResolvedValue([])

    const result = await getTopProducts(STORE_ID, { period: 'day', limit: 10 })

    expect(result).toHaveLength(0)
  })

  it('usa cache quando disponível', async () => {
    const cached = [{ rank: 1, productId: 'p1', name: 'Pizza', quantity: 10, revenue: 400 }]
    ;(mockCache.get as jest.Mock).mockResolvedValue(cached)

    const result = await getTopProducts(STORE_ID, { period: 'day', limit: 10 })

    expect(result).toEqual(cached)
    expect(mockPrisma.orderItem.findMany).not.toHaveBeenCalled()
  })
})

// ─── getPeakHours ─────────────────────────────────────────────────────────────

describe('getPeakHours', () => {
  it('retorna array de 24 horas (0-23) com contagem de pedidos', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    const result = await getPeakHours(STORE_ID)

    expect(result).toHaveLength(24)
    expect(result[0]).toHaveProperty('hour', 0)
    expect(result[23]).toHaveProperty('hour', 23)
  })

  it('conta pedidos por hora corretamente', async () => {
    // Criamos pedidos em horas específicas (UTC; a função converte para SP)
    const orders = [
      { createdAt: new Date('2026-04-01T15:00:00Z') }, // 12h SP (UTC-3)
      { createdAt: new Date('2026-04-01T15:30:00Z') }, // 12h SP
      { createdAt: new Date('2026-04-01T18:00:00Z') }, // 15h SP
    ]
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(orders)

    const result = await getPeakHours(STORE_ID)

    const hour12 = result.find((h: { hour: number; count: number }) => h.hour === 12)
    expect(hour12?.count).toBe(2)
  })

  it('usa cache quando disponível', async () => {
    const cached = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }))
    ;(mockCache.get as jest.Mock).mockResolvedValue(cached)

    const result = await getPeakHours(STORE_ID)

    expect(result).toEqual(cached)
    expect(mockPrisma.order.findMany).not.toHaveBeenCalled()
  })
})

// ─── getClientRanking ─────────────────────────────────────────────────────────

describe('getClientRanking', () => {
  const defaultQuery = { period: '30d' as const, page: 1, limit: 10 }

  const orders = [
    makeOrder({ clientWhatsapp: '5511111110001', clientName: 'Ana', total: 150 }),
    makeOrder({ clientWhatsapp: '5511111110001', clientName: 'Ana', total: 100 }),
    makeOrder({ clientWhatsapp: '5511111110002', clientName: 'Bruno', total: 500 }),
  ]

  it('ordena clientes por total gasto decrescente', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(orders)

    const result = await getClientRanking(STORE_ID, defaultQuery)

    expect(result.clients[0].whatsapp).toBe('5511111110002') // Bruno: R$ 500
    expect(result.clients[0].position).toBe(1)
    expect(result.clients[1].whatsapp).toBe('5511111110001') // Ana: R$ 250
    expect(result.clients[1].position).toBe(2)
  })

  it('agrega pedidos do mesmo cliente corretamente', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(orders)

    const result = await getClientRanking(STORE_ID, defaultQuery)

    const ana = result.clients.find((c) => c.whatsapp === '5511111110001')
    expect(ana?.totalOrders).toBe(2)
    expect(ana?.totalSpent).toBe(250)
  })

  it('retorna total de clientes e paginação', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(orders)

    const result = await getClientRanking(STORE_ID, defaultQuery)

    expect(result.total).toBe(2) // 2 clientes únicos
    expect(result.page).toBe(1)
    expect(result.limit).toBe(10)
  })

  it('filtra por nome ou whatsapp quando search informado', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(orders)

    const result = await getClientRanking(STORE_ID, { ...defaultQuery, search: 'Bruno' })

    expect(result.clients).toHaveLength(1)
    expect(result.clients[0].name).toBe('Bruno')
  })

  it('filtra por whatsapp parcial (case-insensitive)', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(orders)

    const result = await getClientRanking(STORE_ID, { ...defaultQuery, search: '0001' })

    expect(result.clients).toHaveLength(1)
    expect(result.clients[0].whatsapp).toBe('5511111110001')
  })

  it('não aplica filtro de data quando period=all', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    await getClientRanking(STORE_ID, { ...defaultQuery, period: 'all' as const })

    const call = (mockPrisma.order.findMany as jest.Mock).mock.calls[0][0]
    expect(call.where.createdAt).toBeUndefined()
  })

  it('aplica filtro de data para period=7d', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    await getClientRanking(STORE_ID, { ...defaultQuery, period: '7d' as const })

    const call = (mockPrisma.order.findMany as jest.Mock).mock.calls[0][0]
    expect(call.where.createdAt).toBeDefined()
    expect(call.where.createdAt.gte).toBeInstanceOf(Date)
  })

  it('pagina corretamente (página 2 offset correto)', async () => {
    const manyOrders = Array.from({ length: 25 }, (_, i) =>
      makeOrder({ clientWhatsapp: `551111111${String(i).padStart(4, '0')}`, total: 100 - i })
    )
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(manyOrders)

    const result = await getClientRanking(STORE_ID, { period: 'all' as const, page: 2, limit: 10 })

    expect(result.clients[0].position).toBe(11)
    expect(result.clients).toHaveLength(10)
  })

  it('usa cache quando disponível', async () => {
    const cached = { clients: [], total: 0, page: 1, limit: 10 }
    ;(mockCache.get as jest.Mock).mockResolvedValue(cached)

    const result = await getClientRanking(STORE_ID, defaultQuery)

    expect(result).toEqual(cached)
    expect(mockPrisma.order.findMany).not.toHaveBeenCalled()
  })

  it('isola clientes por storeId (multi-tenant)', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    await getClientRanking(STORE_ID, defaultQuery)

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ storeId: STORE_ID }),
      })
    )
  })
})

// ─── getClientDetail ──────────────────────────────────────────────────────────

describe('getClientDetail', () => {
  const WHATSAPP = '5511999990001'

  it('agrega corretamente pedidos do cliente com múltiplos pedidos', async () => {
    // Mais recente primeiro (orderBy desc)
    const latest = {
      total: 100,
      createdAt: new Date('2026-04-10T12:00:00Z'),
      clientName: 'Ana Silva',
      address: { street: 'Rua A', number: '100' },
    }
    const middle = {
      total: 50,
      createdAt: new Date('2026-04-05T12:00:00Z'),
      clientName: 'Ana',
      address: { street: 'Rua B' },
    }
    const earliest = {
      total: 150,
      createdAt: new Date('2026-04-01T12:00:00Z'),
      clientName: 'Ana',
      address: null,
    }
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([latest, middle, earliest])

    const result = await getClientDetail(STORE_ID, WHATSAPP)

    expect(result.whatsapp).toBe(WHATSAPP)
    expect(result.name).toBe('Ana Silva') // nome do mais recente
    expect(result.lastAddress).toEqual({ street: 'Rua A', number: '100' })
    expect(result.totalOrders).toBe(3)
    expect(result.totalSpent).toBe(300)
    expect(result.averageTicket).toBe(100)
    expect(result.firstOrderAt).toBe('2026-04-01T12:00:00.000Z')
    expect(result.lastOrderAt).toBe('2026-04-10T12:00:00.000Z')
  })

  it('lança AppError 404 quando cliente não tem pedidos', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    await expect(getClientDetail(STORE_ID, WHATSAPP)).rejects.toMatchObject({
      status: 404,
      message: 'Cliente não encontrado',
    })
  })

  it('isola busca por storeId (multi-tenant — whatsapp igual em outra loja não vaza)', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    await expect(getClientDetail(STORE_ID, WHATSAPP)).rejects.toMatchObject({ status: 404 })

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storeId: STORE_ID,
          clientWhatsapp: WHATSAPP,
          status: { notIn: ['CANCELLED', 'PENDING', 'WAITING_PAYMENT_PROOF'] },
        }),
      })
    )
  })
})
