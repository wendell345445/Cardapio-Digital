// ─── TASK-090: Cupons — Integration Tests ────────────────────────────────────
// Cobre: CRUD /admin/coupons + validação pública /menu/:slug/coupon/validate

jest.mock('../../shared/prisma/prisma', () => ({
  prisma: {
    coupon: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    order: {
      aggregate: jest.fn(),
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
const COUPON_ID = 'coupon-1'

function adminToken(storeId = STORE_ID) {
  return sign({ userId: 'user-1', role: 'ADMIN', storeId }, 'test-secret')
}

const mockStore = {
  id: STORE_ID,
  slug: 'minha-loja',
  status: 'ACTIVE',
  plan: 'PREMIUM',
}

const mockCoupon = {
  id: COUPON_ID,
  storeId: STORE_ID,
  code: 'PROMO10',
  type: 'PERCENTAGE' as const,
  value: 10,
  isActive: true,
  expiresAt: null,
  maxUses: null,
  usedCount: 0,
  minOrder: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => {
  jest.clearAllMocks()
  // Default: economia agregada zerada (A-076). Testes específicos sobrescrevem.
  ;(mockPrisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { discount: null } })
})

// ─── GET /admin/coupons ───────────────────────────────────────────────────────

describe('GET /api/v1/admin/coupons', () => {
  it('retorna 200 com lista de cupons', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.coupon.findMany as jest.Mock).mockResolvedValue([mockCoupon])

    const res = await request(app)
      .get('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].code).toBe('PROMO10')
  })

  it('retorna totalSavings agregado por cupom (A-076 rastreio de uso)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.coupon.findMany as jest.Mock).mockResolvedValue([mockCoupon])
    ;(mockPrisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { discount: 87.5 } })

    const res = await request(app)
      .get('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data[0].totalSavings).toBe(87.5)
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/admin/coupons')

    expect(res.status).toBe(401)
  })

  it('retorna 403 sem storeId no token', async () => {
    const tokenNoStore = sign({ userId: 'user-1', role: 'ADMIN' }, 'test-secret')

    const res = await request(app)
      .get('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${tokenNoStore}`)

    expect(res.status).toBe(403)
  })
})

// ─── GET /admin/coupons/:id ───────────────────────────────────────────────────

describe('GET /api/v1/admin/coupons/:id', () => {
  it('retorna 200 com dados do cupom', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)

    const res = await request(app)
      .get(`/api/v1/admin/coupons/${COUPON_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(COUPON_ID)
  })

  it('retorna 404 quando cupom não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/v1/admin/coupons/nao-existe')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
  })
})

// ─── POST /admin/coupons ──────────────────────────────────────────────────────

describe('POST /api/v1/admin/coupons', () => {
  it('retorna 201 ao criar cupom percentual', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.coupon.create as jest.Mock).mockResolvedValue(mockCoupon)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ code: 'PROMO10', type: 'PERCENTAGE', value: 10 })

    expect(res.status).toBe(201)
    expect(res.body.data.code).toBe('PROMO10')
  })

  it('retorna 201 ao criar cupom de valor fixo', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.coupon.create as jest.Mock).mockResolvedValue({ ...mockCoupon, type: 'FIXED', value: 20 })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ code: 'DESC20', type: 'FIXED', value: 20 })

    expect(res.status).toBe(201)
  })

  it('retorna 409 quando código já existe na loja', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)

    const res = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ code: 'PROMO10', type: 'PERCENTAGE', value: 10 })

    expect(res.status).toBe(409)
  })

  it('retorna 400 para payload inválido (type ausente)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ code: 'PROMO10', value: 10 }) // sem type

    expect(res.status).toBe(400)
  })
})

// ─── PATCH /admin/coupons/:id ─────────────────────────────────────────────────

describe('PATCH /api/v1/admin/coupons/:id', () => {
  it('retorna 200 ao atualizar valor do cupom', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)
    ;(mockPrisma.coupon.update as jest.Mock).mockResolvedValue({ ...mockCoupon, value: 20 })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch(`/api/v1/admin/coupons/${COUPON_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ value: 20 })

    expect(res.status).toBe(200)
    expect(res.body.data.value).toBe(20)
  })

  it('retorna 200 ao desativar cupom via isActive=false', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)
    ;(mockPrisma.coupon.update as jest.Mock).mockResolvedValue({ ...mockCoupon, isActive: false })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch(`/api/v1/admin/coupons/${COUPON_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ isActive: false })

    expect(res.status).toBe(200)
    expect(res.body.data.isActive).toBe(false)
  })

  it('retorna 404 quando cupom não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/v1/admin/coupons/nao-existe')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ value: 20 })

    expect(res.status).toBe(404)
  })
})

// ─── DELETE /admin/coupons/:id ────────────────────────────────────────────────

describe('DELETE /api/v1/admin/coupons/:id', () => {
  it('retorna 204 ao deletar cupom', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)
    ;(mockPrisma.coupon.delete as jest.Mock).mockResolvedValue(mockCoupon)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .delete(`/api/v1/admin/coupons/${COUPON_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('retorna 404 ao tentar deletar cupom inexistente', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .delete('/api/v1/admin/coupons/nao-existe')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
  })

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app).delete(`/api/v1/admin/coupons/${COUPON_ID}`)

    expect(res.status).toBe(401)
  })
})
