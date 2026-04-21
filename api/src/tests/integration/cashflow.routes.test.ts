// ─── TASK-095: Controle de Caixa — Integration Tests ─────────────────────────
// Cobre: POST /admin/cashflows (abrir), GET /admin/cashflows/current,
//        PATCH /:id/initial-amount, POST /:id/adjustments, GET /:id/summary,
//        POST /:id/close

jest.mock('../../shared/prisma/prisma', () => ({
  prisma: {
    cashFlow: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cashFlowAdjustment: {
      create: jest.fn(),
    },
    cashFlowItem: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
    store: {
      findUnique: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('../../shared/redis/redis', () => ({
  cache: { del: jest.fn(), get: jest.fn(), set: jest.fn() },
}))

jest.mock('../../shared/socket/socket', () => ({
  emit: {
    cashFlowUpdated: jest.fn(),
  },
}))

jest.mock('../../modules/auth/passport.config', () => ({
  configurePassport: jest.fn(),
}))

import request from 'supertest'
import { sign } from 'jsonwebtoken'

import { app } from '../../app'
import { prisma } from '../../shared/prisma/prisma'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

const STORE_ID = 'store-1'
const CF_ID = 'cf-1'

function adminToken(storeId = STORE_ID) {
  return sign({ userId: 'user-1', role: 'ADMIN', storeId }, 'test-secret')
}

const mockStore = {
  id: STORE_ID,
  slug: 'minha-loja',
  status: 'ACTIVE',
  plan: 'PREMIUM',
}

const mockOpenCashFlow = {
  id: CF_ID,
  storeId: STORE_ID,
  status: 'OPEN',
  initialAmount: 100,
  openedAt: new Date(),
  closedAt: null,
  adjustments: [],
  items: [],
  _count: { items: 0 },
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => jest.resetAllMocks())

// ─── GET /admin/cashflows ─────────────────────────────────────────────────────

describe('GET /api/v1/admin/cashflows', () => {
  it('retorna 200 com histórico de caixas', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findMany as jest.Mock).mockResolvedValue([mockOpenCashFlow])

    const res = await request(app)
      .get('/api/v1/admin/cashflows')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/admin/cashflows')
    expect(res.status).toBe(401)
  })
})

// ─── GET /admin/cashflows/current ────────────────────────────────────────────

describe('GET /api/v1/admin/cashflows/current', () => {
  it('retorna 200 com caixa aberto atual', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findFirst as jest.Mock).mockResolvedValue(mockOpenCashFlow)

    const res = await request(app)
      .get('/api/v1/admin/cashflows/current')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(CF_ID)
    expect(res.body.data.status).toBe('OPEN')
  })

  it('retorna 200 com null quando não há caixa aberto', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/v1/admin/cashflows/current')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })
})

// ─── POST /admin/cashflows ────────────────────────────────────────────────────

describe('POST /api/v1/admin/cashflows', () => {
  it('retorna 201 ao abrir caixa com troco inicial', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.cashFlow.create as jest.Mock).mockResolvedValue(mockOpenCashFlow)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/admin/cashflows')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ initialAmount: 100 })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('OPEN')
    expect(res.body.data.initialAmount).toBe(100)
  })

  it('retorna 422 quando já existe caixa aberto', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findFirst as jest.Mock).mockResolvedValue(mockOpenCashFlow)

    const res = await request(app)
      .post('/api/v1/admin/cashflows')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ initialAmount: 50 })

    expect(res.status).toBe(422)
  })

  it('retorna 400 para payload inválido (initialAmount negativo)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .post('/api/v1/admin/cashflows')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ initialAmount: -10 })

    expect(res.status).toBe(400)
  })
})

// ─── PATCH /admin/cashflows/:id/initial-amount ───────────────────────────────

describe('PATCH /api/v1/admin/cashflows/:id/initial-amount', () => {
  it('retorna 200 ao ajustar troco inicial', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(mockOpenCashFlow)
    ;(mockPrisma.cashFlow.update as jest.Mock).mockResolvedValue({
      ...mockOpenCashFlow,
      initialAmount: 150,
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch(`/api/v1/admin/cashflows/${CF_ID}/initial-amount`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ initialAmount: 150 })

    expect(res.status).toBe(200)
    expect(res.body.data.initialAmount).toBe(150)
  })

  it('retorna 404 quando caixa não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/v1/admin/cashflows/nao-existe/initial-amount')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ initialAmount: 150 })

    expect(res.status).toBe(404)
  })

  it('retorna 422 quando caixa está fechado', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue({
      ...mockOpenCashFlow,
      status: 'CLOSED',
    })

    const res = await request(app)
      .patch(`/api/v1/admin/cashflows/${CF_ID}/initial-amount`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ initialAmount: 150 })

    expect(res.status).toBe(422)
  })
})

// ─── POST /admin/cashflows/:id/adjustments ───────────────────────────────────

describe('POST /api/v1/admin/cashflows/:id/adjustments', () => {
  const mockAdj = {
    id: 'adj-1',
    cashFlowId: CF_ID,
    type: 'SUPPLY',
    amount: 50,
    notes: 'Reforço',
    userId: 'user-1',
    createdAt: new Date(),
  }

  it('retorna 201 ao registrar suprimento', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(mockOpenCashFlow)
    ;(mockPrisma.cashFlowAdjustment.create as jest.Mock).mockResolvedValue(mockAdj)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .post(`/api/v1/admin/cashflows/${CF_ID}/adjustments`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ type: 'SUPPLY', amount: 50, notes: 'Reforço' })

    expect(res.status).toBe(201)
    expect(res.body.data.type).toBe('SUPPLY')
  })

  it('retorna 201 ao registrar sangria (BLEED)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(mockOpenCashFlow)
    ;(mockPrisma.cashFlowAdjustment.create as jest.Mock).mockResolvedValue({
      ...mockAdj,
      type: 'BLEED',
      amount: 30,
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .post(`/api/v1/admin/cashflows/${CF_ID}/adjustments`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ type: 'BLEED', amount: 30, notes: 'Sangria' })

    expect(res.status).toBe(201)
    expect(res.body.data.type).toBe('BLEED')
  })

  it('retorna 400 para type inválido', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .post(`/api/v1/admin/cashflows/${CF_ID}/adjustments`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ type: 'INVALIDO', amount: 50 })

    expect(res.status).toBe(400)
  })

  it('retorna 422 quando caixa está fechado', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue({
      ...mockOpenCashFlow,
      status: 'CLOSED',
    })

    const res = await request(app)
      .post(`/api/v1/admin/cashflows/${CF_ID}/adjustments`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ type: 'SUPPLY', amount: 50, notes: 'Teste' })

    expect(res.status).toBe(422)
  })
})

// ─── GET /admin/cashflows/:id/summary ────────────────────────────────────────

describe('GET /api/v1/admin/cashflows/:id/summary', () => {
  const cfWithItems = {
    ...mockOpenCashFlow,
    initialAmount: 100,
    adjustments: [
      { type: 'SUPPLY', amount: 50 },
      { type: 'BLEED', amount: 20 },
    ],
    items: [
      { order: { paymentMethod: 'CASH_ON_DELIVERY', total: 80 }, amount: 80 },
      { order: { paymentMethod: 'PIX', total: 40 }, amount: 40 },
    ],
  }

  it('retorna 200 com resumo do caixa incluindo saldo esperado', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(cfWithItems)

    const res = await request(app)
      .get(`/api/v1/admin/cashflows/${CF_ID}/summary`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.summary).toMatchObject({
      totalCash: 80,
      totalPix: 40,
      totalSupply: 50,
      totalBleed: 20,
      expectedCash: 210, // 100 + 80 + 50 - 20
      orderCount: 2,
    })
  })

  it('retorna 404 quando caixa não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/v1/admin/cashflows/nao-existe/summary')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
  })
})

// ─── POST /admin/cashflows/:id/close ─────────────────────────────────────────

describe('POST /api/v1/admin/cashflows/:id/close', () => {
  const cfWithItems = {
    ...mockOpenCashFlow,
    adjustments: [],
    items: [
      { order: { paymentMethod: 'CASH_ON_DELIVERY', total: 80 }, amount: 80 },
    ],
  }

  it('retorna 200 ao fechar caixa sem diferença', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findUnique as jest.Mock)
      .mockResolvedValueOnce(mockOpenCashFlow) // requireOpenCashFlow
      .mockResolvedValueOnce(cfWithItems)       // getCashFlowSummary
    ;(mockPrisma.cashFlow.update as jest.Mock).mockResolvedValue({
      ...mockOpenCashFlow,
      status: 'CLOSED',
      adjustments: [],
      items: [],
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    // expectedCash = 100 + 80 = 180
    const res = await request(app)
      .post(`/api/v1/admin/cashflows/${CF_ID}/close`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ countedAmount: 180 })

    expect(res.status).toBe(200)
    expect(res.body.data.cashFlow.status).toBe('CLOSED')
    expect(res.body.data.summary.difference).toBe(0)
  })

  it('retorna 422 quando há diferença sem justificativa', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findUnique as jest.Mock)
      .mockResolvedValueOnce(mockOpenCashFlow)
      .mockResolvedValueOnce(cfWithItems)

    // expectedCash = 180; contado = 150 → diferença = -30
    const res = await request(app)
      .post(`/api/v1/admin/cashflows/${CF_ID}/close`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ countedAmount: 150 })

    expect(res.status).toBe(422)
  })

  it('retorna 200 ao fechar com diferença e justificativa', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.cashFlow.findUnique as jest.Mock)
      .mockResolvedValueOnce(mockOpenCashFlow)
      .mockResolvedValueOnce(cfWithItems)
    ;(mockPrisma.cashFlow.update as jest.Mock).mockResolvedValue({
      ...mockOpenCashFlow,
      status: 'CLOSED',
      adjustments: [],
      items: [],
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .post(`/api/v1/admin/cashflows/${CF_ID}/close`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ countedAmount: 150, justification: 'Erro de troco' })

    expect(res.status).toBe(200)
    expect(res.body.data.summary.difference).toBe(-30)
  })

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/cashflows/${CF_ID}/close`)
      .send({ countedAmount: 100 })

    expect(res.status).toBe(401)
  })
})
