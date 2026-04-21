// ─── TASK-093/094: Analytics e Ranking de Clientes — Integration Tests ────────
// Cobre: GET /admin/analytics/sales, /top-products, /peak-hours,
//        GET /admin/analytics/clients/ranking

jest.mock('../../shared/prisma/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    orderItem: {
      findMany: jest.fn(),
    },
    store: {
      findUnique: jest.fn(),
    },
    customer: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('../../shared/redis/redis', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}))

jest.mock('../../modules/auth/passport.config', () => ({
  configurePassport: jest.fn(),
}))

import request from 'supertest'
import { sign } from 'jsonwebtoken'

import { app } from '../../app'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockCache = cache as jest.Mocked<typeof cache>

process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

const STORE_ID = 'store-1'

function adminToken(storeId = STORE_ID) {
  return sign({ userId: 'user-1', role: 'ADMIN', storeId }, 'test-secret')
}

const mockStore = {
  id: STORE_ID,
  slug: 'minha-loja',
  status: 'ACTIVE',
  plan: 'PREMIUM',
}

const mockOrders = [
  {
    total: 100,
    createdAt: new Date('2026-04-01T12:00:00Z'),
    clientWhatsapp: '5511111110001',
    clientName: 'Ana',
    clientId: 'c-1',
  },
  {
    total: 60,
    createdAt: new Date('2026-04-02T14:00:00Z'),
    clientWhatsapp: '5511111110002',
    clientName: 'Bruno',
    clientId: 'c-2',
  },
]

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockCache.get as jest.Mock).mockResolvedValue(null)
  ;(mockCache.set as jest.Mock).mockResolvedValue(undefined)
  ;(mockCache.del as jest.Mock).mockResolvedValue(undefined)
  ;(mockPrisma.order.count as jest.Mock).mockResolvedValue(0)
  ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
  ;(mockPrisma.customer.findMany as jest.Mock).mockResolvedValue([])
})

// ─── GET /admin/analytics/sales ───────────────────────────────────────────────

describe('GET /api/v1/admin/analytics/sales', () => {
  it('retorna 200 com resumo de vendas para period=day', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders)

    const res = await request(app)
      .get('/api/v1/admin/analytics/sales?period=day')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('totalRevenue')
    expect(res.body.data).toHaveProperty('totalOrders')
    expect(res.body.data).toHaveProperty('averageTicket')
    expect(res.body.data).toHaveProperty('series')
    expect(res.body.data.totalRevenue).toBe(160)
    expect(res.body.data.totalOrders).toBe(2)
  })

  it('retorna 200 com resumo para period=week', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders)

    const res = await request(app)
      .get('/api/v1/admin/analytics/sales?period=week')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.totalOrders).toBe(2)
  })

  it('retorna 200 com resumo para period=month', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    const res = await request(app)
      .get('/api/v1/admin/analytics/sales?period=month')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.totalRevenue).toBe(0)
  })

  it('usa period=day por padrão quando não informado', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    const res = await request(app)
      .get('/api/v1/admin/analytics/sales')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/admin/analytics/sales')
    expect(res.status).toBe(401)
  })

  it('retorna 403 sem storeId no token', async () => {
    const tokenNoStore = sign({ userId: 'user-1', role: 'ADMIN' }, 'test-secret')

    const res = await request(app)
      .get('/api/v1/admin/analytics/sales')
      .set('Authorization', `Bearer ${tokenNoStore}`)

    expect(res.status).toBe(403)
  })

  it('retorna dados do cache quando disponível (não consulta DB)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    const cached = { totalRevenue: 999, totalOrders: 5, averageTicket: 199.8, timeline: [] }
    ;(mockCache.get as jest.Mock).mockResolvedValue(cached)

    const res = await request(app)
      .get('/api/v1/admin/analytics/sales?period=day')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.totalRevenue).toBe(999)
    expect(mockPrisma.order.findMany).not.toHaveBeenCalled()
  })
})

// ─── GET /admin/analytics/top-products ───────────────────────────────────────

describe('GET /api/v1/admin/analytics/top-products', () => {
  const mockItems = [
    { productId: 'p1', productName: 'Pizza', quantity: 5, totalPrice: 200 },
    { productId: 'p2', productName: 'Hamburguer', quantity: 3, totalPrice: 90 },
  ]

  it('retorna 200 com top produtos', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.orderItem.findMany as jest.Mock).mockResolvedValue(mockItems)

    const res = await request(app)
      .get('/api/v1/admin/analytics/top-products?period=month&limit=10')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].productId).toBe('p1') // mais vendido (primeiro)
    expect(res.body.data[0].quantity).toBe(5)
  })

  it('respeita o parâmetro limit', async () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      productId: `p${i}`,
      productName: `Produto ${i}`,
      quantity: 15 - i,
      totalPrice: 100,
    }))
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.orderItem.findMany as jest.Mock).mockResolvedValue(items)

    const res = await request(app)
      .get('/api/v1/admin/analytics/top-products?period=month&limit=5')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(5)
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/admin/analytics/top-products')
    expect(res.status).toBe(401)
  })
})

// ─── GET /admin/analytics/peak-hours ─────────────────────────────────────────

describe('GET /api/v1/admin/analytics/peak-hours', () => {
  it('retorna 200 com 24 registros (horas 0-23)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    const res = await request(app)
      .get('/api/v1/admin/analytics/peak-hours')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(24)
    expect(res.body.data[0]).toHaveProperty('hour', 0)
    expect(res.body.data[23]).toHaveProperty('hour', 23)
  })

  it('contabiliza pedidos por hora', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([
      { createdAt: new Date('2026-04-01T15:00:00Z') }, // 12h SP
      { createdAt: new Date('2026-04-01T15:30:00Z') }, // 12h SP
    ])

    const res = await request(app)
      .get('/api/v1/admin/analytics/peak-hours')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    const hour12 = res.body.data.find((h: { hour: number }) => h.hour === 12)
    expect(hour12?.count).toBe(2)
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/admin/analytics/peak-hours')
    expect(res.status).toBe(401)
  })
})

// ─── GET /admin/analytics/payment-breakdown (A-085) ──────────────────────────

describe('GET /api/v1/admin/analytics/payment-breakdown', () => {
  const paymentOrders = [
    { total: 100, paymentMethod: 'PIX', createdAt: new Date('2026-04-01T12:00:00Z') },
    { total: 50, paymentMethod: 'PIX', createdAt: new Date('2026-04-02T14:00:00Z') },
    { total: 50, paymentMethod: 'CASH_ON_DELIVERY', createdAt: new Date('2026-04-02T16:00:00Z') },
  ]

  it('retorna 200 com breakdown por método ordenado por receita', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(paymentOrders)

    const res = await request(app)
      .get('/api/v1/admin/analytics/payment-breakdown?period=week')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].method).toBe('PIX')
    expect(res.body.data[0].count).toBe(2)
    expect(res.body.data[0].revenue).toBe(150)
    expect(res.body.data[0].percentage).toBeCloseTo(75)
    expect(res.body.data[1].method).toBe('CASH_ON_DELIVERY')
  })

  it('usa period=week por padrão', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    const res = await request(app)
      .get('/api/v1/admin/analytics/payment-breakdown')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/admin/analytics/payment-breakdown')
    expect(res.status).toBe(401)
  })
})

// ─── GET /admin/analytics/clients/ranking ────────────────────────────────────

describe('GET /api/v1/admin/analytics/clients/ranking', () => {
  const rankingOrders = [
    { total: 200, createdAt: new Date(), clientWhatsapp: '5511111110001', clientName: 'Ana', clientId: 'c-1' },
    { total: 150, createdAt: new Date(), clientWhatsapp: '5511111110001', clientName: 'Ana', clientId: 'c-1' },
    { total: 500, createdAt: new Date(), clientWhatsapp: '5511111110002', clientName: 'Bruno', clientId: 'c-2' },
  ]

  it('retorna 200 com ranking de clientes por valor gasto', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(rankingOrders)

    const res = await request(app)
      .get('/api/v1/admin/analytics/clients/ranking?period=30d&page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.clients).toHaveLength(2)
    expect(res.body.data.clients[0].whatsapp).toBe('5511111110002') // Bruno: R$ 500
    expect(res.body.data.clients[0].position).toBe(1)
    expect(res.body.data.total).toBe(2)
  })

  it('filtra clientes por busca (nome)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(rankingOrders)

    const res = await request(app)
      .get('/api/v1/admin/analytics/clients/ranking?period=30d&page=1&limit=10&search=Bruno')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.clients).toHaveLength(1)
    expect(res.body.data.clients[0].name).toBe('Bruno')
  })

  it('suporta period=all (sem filtro de data)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(rankingOrders)

    const res = await request(app)
      .get('/api/v1/admin/analytics/clients/ranking?period=all&page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.clients).toHaveLength(2)
  })

  it('pagina corretamente os resultados', async () => {
    const manyOrders = Array.from({ length: 20 }, (_, i) => ({
      total: 100 - i,
      createdAt: new Date(),
      clientWhatsapp: `551111111${String(i).padStart(4, '0')}`,
      clientName: `Cliente ${i}`,
      clientId: `c-${i}`,
    }))
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(manyOrders)

    const res = await request(app)
      .get('/api/v1/admin/analytics/clients/ranking?period=all&page=2&limit=10')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.clients).toHaveLength(10)
    expect(res.body.data.clients[0].position).toBe(11)
    expect(res.body.data.page).toBe(2)
  })

  it('isola clientes pela loja do token (multi-tenant)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    await request(app)
      .get('/api/v1/admin/analytics/clients/ranking?period=all&page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ storeId: STORE_ID }),
      })
    )
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/admin/analytics/clients/ranking')
    expect(res.status).toBe(401)
  })
})
