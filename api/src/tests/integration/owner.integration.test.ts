/**
 * Integration tests — Epic 02: Owner Stores
 *
 * Covers:
 *  - TASK-020: GET /api/v1/owner/stores (listagem + filtro)
 *  - TASK-021: POST /api/v1/owner/stores (criar loja + validações 422)
 *  - TASK-022: GET /api/v1/owner/stores/:id, PATCH, DELETE (cancel)
 *  - TASK-023: PATCH /api/v1/owner/stores/:id/plan
 *  - TASK-024: GET /api/v1/owner/stores/:id/audit-logs
 *  - RBAC: acesso bloqueado para não-OWNER
 */

import { sign } from 'jsonwebtoken'
import request from 'supertest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../shared/prisma/prisma', () => ({
  prisma: {
    store: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    businessHour: {
      createMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../shared/stripe/stripe.service', () => ({
  createCustomer: jest.fn(),
  createSubscription: jest.fn(),
  updateSubscription: jest.fn(),
  PLAN_PRICE_IDS: { PROFESSIONAL: 'price_pro', PREMIUM: 'price_prem' },
}))

jest.mock('../../shared/email/email.service', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPlanChangeEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../modules/auth/passport.config', () => ({ configurePassport: jest.fn() }))

import { app } from '../../app'
import { prisma } from '../../shared/prisma/prisma'
import { createCustomer, createSubscription, updateSubscription } from '../../shared/stripe/stripe.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'
process.env.FRONTEND_URL = 'http://localhost:5173'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function ownerToken() {
  return sign({ userId: 'owner-1', role: 'OWNER', storeId: null }, 'test-secret')
}

function adminToken() {
  return sign({ userId: 'admin-1', role: 'ADMIN', storeId: 'store-1' }, 'test-secret')
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeStore = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'store-1',
  name: 'Loja Test',
  slug: 'loja-test',
  plan: 'PROFESSIONAL',
  status: 'TRIAL',
  phone: '48999998888',
  features: {},
  stripeCustomerId: 'cus_123',
  stripeSubscriptionId: 'sub_123',
  stripeTrialEndsAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

beforeEach(() => jest.clearAllMocks())

// ─── RBAC: acesso bloqueado para não-OWNER ────────────────────────────────────

describe('RBAC — non-OWNER access blocked (TASK-020)', () => {
  it('returns 403 for ADMIN role on GET /owner/stores', async () => {
    const res = await request(app)
      .get('/api/v1/owner/stores')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(403)
  })

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/v1/owner/stores')
    expect(res.status).toBe(401)
  })
})

// ─── TASK-020: GET /owner/stores ──────────────────────────────────────────────

describe('GET /api/v1/owner/stores (TASK-020)', () => {
  it('returns stores list with MRR', async () => {
    ;(mockPrisma.store.findMany as jest.Mock).mockResolvedValue([
      makeStore({ status: 'ACTIVE', plan: 'PROFESSIONAL' }),
    ])

    const res = await request(app)
      .get('/api/v1/owner/stores')
      .set('Authorization', `Bearer ${ownerToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.stores).toHaveLength(1)
    expect(res.body.data.mrr).toBeDefined()
  })

  it('passes status query filter to service', async () => {
    ;(mockPrisma.store.findMany as jest.Mock).mockResolvedValue([])

    await request(app)
      .get('/api/v1/owner/stores?status=ACTIVE')
      .set('Authorization', `Bearer ${ownerToken()}`)

    expect(mockPrisma.store.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE' } })
    )
  })

  it('returns 400 for invalid status query param', async () => {
    const res = await request(app)
      .get('/api/v1/owner/stores?status=INVALID')
      .set('Authorization', `Bearer ${ownerToken()}`)

    // Convention: Zod schema errors → 400 (via errorHandler); business-rule
    // violations via AppError → 422. Outros módulos (products, categories, etc)
    // seguem o mesmo padrão — ver error.middleware.test.ts.
    expect(res.status).toBe(400)
  })
})

// ─── TASK-021: POST /owner/stores ─────────────────────────────────────────────

describe('POST /api/v1/owner/stores (TASK-021)', () => {
  const validPayload = {
    name: 'Nova Loja',
    slug: 'nova-loja',
    plan: 'PROFESSIONAL',
    adminEmail: 'admin@novaloja.com',
    whatsapp: '48999998877',
  }

  const newStore = makeStore({ id: 'store-new', slug: 'nova-loja' })

  beforeEach(() => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null) // slug free
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)  // email free
    ;(createCustomer as jest.Mock).mockResolvedValue({ id: 'cus_new', email: 'admin@novaloja.com', name: 'Nova Loja' })
    ;(createSubscription as jest.Mock).mockResolvedValue({ id: 'sub_new', status: 'trialing', items: { data: [] }, customer: 'cus_new', trial_end: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 })
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) =>
      fn({
        store: { create: jest.fn().mockResolvedValue(newStore) },
        user: { create: jest.fn() },
        businessHour: { createMany: jest.fn() },
        auditLog: { create: jest.fn() },
      })
    )
  })

  it('creates store and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/owner/stores')
      .set('Authorization', `Bearer ${ownerToken()}`)
      .send(validPayload)

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBe('store-new')
  })

  it('returns 422 when slug is already taken (RN-001)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore())

    const res = await request(app)
      .post('/api/v1/owner/stores')
      .set('Authorization', `Bearer ${ownerToken()}`)
      .send(validPayload)

    expect(res.status).toBe(422)
    expect(res.body.success).toBe(false)
  })

  it('returns 422 when adminEmail already belongs to another store (RN-002)', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-user' })

    const res = await request(app)
      .post('/api/v1/owner/stores')
      .set('Authorization', `Bearer ${ownerToken()}`)
      .send(validPayload)

    expect(res.status).toBe(422)
  })

  it('returns 400 when slug has uppercase letters', async () => {
    const res = await request(app)
      .post('/api/v1/owner/stores')
      .set('Authorization', `Bearer ${ownerToken()}`)
      .send({ ...validPayload, slug: 'NovaLoja' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when whatsapp has wrong number of digits (RN-003)', async () => {
    const res = await request(app)
      .post('/api/v1/owner/stores')
      .set('Authorization', `Bearer ${ownerToken()}`)
      .send({ ...validPayload, whatsapp: '4899999' })

    // RN-003 é aplicado no próprio schema Zod (regex `^\d{11}$`), então cai
    // no branch ZodError do errorHandler → 400, não 422 do AppError.
    expect(res.status).toBe(400)
  })

  it('returns 400 when adminEmail is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/owner/stores')
      .set('Authorization', `Bearer ${ownerToken()}`)
      .send({ ...validPayload, adminEmail: 'not-an-email' })

    expect(res.status).toBe(400)
  })
})

// ─── TASK-022: GET /owner/stores/:id ─────────────────────────────────────────

describe('GET /api/v1/owner/stores/:id (TASK-022)', () => {
  it('returns store details', async () => {
    const store = { ...makeStore(), users: [], businessHours: [] }
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(store)

    const res = await request(app)
      .get('/api/v1/owner/stores/store-1')
      .set('Authorization', `Bearer ${ownerToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('store-1')
  })

  it('returns 404 when store not found', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/v1/owner/stores/non-existent')
      .set('Authorization', `Bearer ${ownerToken()}`)

    expect(res.status).toBe(404)
  })
})

// ─── TASK-022: PATCH /owner/stores/:id ───────────────────────────────────────

describe('PATCH /api/v1/owner/stores/:id (TASK-022)', () => {
  it('updates store name and returns updated data', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore({ name: 'Nome Atualizado' }))
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch('/api/v1/owner/stores/store-1')
      .set('Authorization', `Bearer ${ownerToken()}`)
      .send({ name: 'Nome Atualizado' })

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('Nome Atualizado')
  })

  it('returns 404 when store not found', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/v1/owner/stores/non-existent')
      .set('Authorization', `Bearer ${ownerToken()}`)
      // `name` precisa ter ≥2 chars (updateStoreSchema) — senão Zod intercepta
      // com 400 antes do service chegar a olhar se a loja existe.
      .send({ name: 'Nome Válido' })

    expect(res.status).toBe(404)
  })
})

// ─── TASK-022: DELETE /owner/stores/:id (cancel) ─────────────────────────────

describe('DELETE /api/v1/owner/stores/:id (TASK-022)', () => {
  it('cancels store (status = CANCELLED)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore({ status: 'ACTIVE' }))
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore({ status: 'CANCELLED' }))
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .delete('/api/v1/owner/stores/store-1')
      .set('Authorization', `Bearer ${ownerToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('CANCELLED')
  })

  it('returns 422 when store is already CANCELLED', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore({ status: 'CANCELLED' }))

    const res = await request(app)
      .delete('/api/v1/owner/stores/store-1')
      .set('Authorization', `Bearer ${ownerToken()}`)

    expect(res.status).toBe(422)
  })

  it('returns 404 when store not found', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .delete('/api/v1/owner/stores/ghost')
      .set('Authorization', `Bearer ${ownerToken()}`)

    expect(res.status).toBe(404)
  })
})

// ─── TASK-023: PATCH /owner/stores/:id/plan ──────────────────────────────────

describe('PATCH /api/v1/owner/stores/:id/plan (TASK-023)', () => {
  const storeWithAdmin = {
    ...makeStore({ plan: 'PROFESSIONAL' }),
    users: [{ email: 'admin@loja.com', name: 'Admin' }],
  }

  beforeEach(() => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(storeWithAdmin)
    ;(updateSubscription as jest.Mock).mockResolvedValue({ id: 'sub_updated' })
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore({ plan: 'PREMIUM' }))
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})
  })

  it('upgrades plan to PREMIUM and returns 200', async () => {
    const res = await request(app)
      .patch('/api/v1/owner/stores/store-1/plan')
      .set('Authorization', `Bearer ${ownerToken()}`)
      .send({ plan: 'PREMIUM' })

    expect(res.status).toBe(200)
    expect(res.body.data.plan).toBe('PREMIUM')
  })

  it('returns 422 when store is already on the requested plan', async () => {
    const res = await request(app)
      .patch('/api/v1/owner/stores/store-1/plan')
      .set('Authorization', `Bearer ${ownerToken()}`)
      .send({ plan: 'PROFESSIONAL' }) // same as current

    expect(res.status).toBe(422)
  })

  it('returns 400 for invalid plan value', async () => {
    const res = await request(app)
      .patch('/api/v1/owner/stores/store-1/plan')
      .set('Authorization', `Bearer ${ownerToken()}`)
      .send({ plan: 'FREE' })

    // Zod enum violation → 400 (schema-level). "já está nesse plano" é 422
    // (business rule via AppError).
    expect(res.status).toBe(400)
  })

  it('returns 404 when store not found', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/v1/owner/stores/ghost/plan')
      .set('Authorization', `Bearer ${ownerToken()}`)
      .send({ plan: 'PREMIUM' })

    expect(res.status).toBe(404)
  })
})

// ─── TASK-024: GET /owner/stores/:id/audit-logs ───────────────────────────────

describe('GET /api/v1/owner/stores/:id/audit-logs (TASK-024)', () => {
  const mockLogs = [
    {
      id: 'log-1',
      action: 'store.create',
      createdAt: new Date().toISOString(),
      user: { id: 'owner-1', email: 'owner@sys.com', name: 'Owner', role: 'OWNER' },
    },
  ]

  beforeEach(() => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs)
    ;(mockPrisma.auditLog.count as jest.Mock).mockResolvedValue(1)
  })

  it('returns logs with pagination metadata', async () => {
    const res = await request(app)
      .get('/api/v1/owner/stores/store-1/audit-logs')
      .set('Authorization', `Bearer ${ownerToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.logs).toHaveLength(1)
    expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 20, total: 1 })
  })

  it('accepts page and limit query params', async () => {
    const res = await request(app)
      .get('/api/v1/owner/stores/store-1/audit-logs?page=2&limit=5')
      .set('Authorization', `Bearer ${ownerToken()}`)

    expect(res.status).toBe(200)
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 })
    )
  })

  it('returns 404 when store not found', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/v1/owner/stores/ghost/audit-logs')
      .set('Authorization', `Bearer ${ownerToken()}`)

    expect(res.status).toBe(404)
  })

  it('accepts action filter query param', async () => {
    await request(app)
      .get('/api/v1/owner/stores/store-1/audit-logs?action=store.create')
      .set('Authorization', `Bearer ${ownerToken()}`)

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: { contains: 'store.create' } }),
      })
    )
  })
})
