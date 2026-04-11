// ─── TASK-040: Categorias CRUD — Integration Tests ───────────────────────────

jest.mock('../../shared/prisma/prisma', () => ({
  prisma: {
    category: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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
const CAT_ID = 'cat-1'

function adminToken(storeId = STORE_ID) {
  return sign({ userId: 'user-1', role: 'ADMIN', storeId }, 'test-secret')
}

const mockCategory = {
  id: CAT_ID,
  storeId: STORE_ID,
  name: 'Pizzas',
  order: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => jest.clearAllMocks())

// ─── GET /admin/categories ────────────────────────────────────────────────────

describe('GET /api/v1/admin/categories', () => {
  it('returns 200 with category list', async () => {
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([mockCategory])

    const res = await request(app)
      .get('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].name).toBe('Pizzas')
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/admin/categories')

    expect(res.status).toBe(401)
  })

  it('returns 403 when user has no storeId in token', async () => {
    const tokenNoStore = sign({ userId: 'user-1', role: 'ADMIN' }, 'test-secret')

    const res = await request(app)
      .get('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${tokenNoStore}`)

    expect(res.status).toBe(403)
  })
})

// ─── POST /admin/categories ───────────────────────────────────────────────────

describe('POST /api/v1/admin/categories', () => {
  it('returns 201 when category is created successfully', async () => {
    ;(mockPrisma.category.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.category.create as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Pizzas', order: 0 })

    expect(res.status).toBe(201)
    expect(res.body.data.id).toBe(CAT_ID)
  })

  it('returns 422 when name already exists in the store', async () => {
    ;(mockPrisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory)

    const res = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Pizzas' })

    expect(res.status).toBe(422)
  })

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ order: 0 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when name is too short (< 2 chars)', async () => {
    const res = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'X' })

    expect(res.status).toBe(400)
  })
})

// ─── PATCH /admin/categories/:id ─────────────────────────────────────────────

describe('PATCH /api/v1/admin/categories/:id', () => {
  it('returns 200 when category is updated', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockPrisma.category.update as jest.Mock).mockResolvedValue({
      ...mockCategory,
      name: 'Lanches',
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch(`/api/v1/admin/categories/${CAT_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Lanches' })

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('Lanches')
  })

  it('returns 404 when category does not exist', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/v1/admin/categories/nonexistent')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Lanches' })

    expect(res.status).toBe(404)
  })

  it('returns 403 when admin from another store tries to access (admin de outra loja não acessa)', async () => {
    // Category exists but belongs to STORE_ID; token is for other-store → 404 (treated as not found)
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory)

    const otherStoreToken = adminToken('other-store')
    const res = await request(app)
      .patch(`/api/v1/admin/categories/${CAT_ID}`)
      .set('Authorization', `Bearer ${otherStoreToken}`)
      .send({ name: 'Hacked' })

    // updateCategory throws 404 when storeId mismatch
    expect(res.status).toBe(404)
  })
})

// ─── DELETE /admin/categories/:id ────────────────────────────────────────────

describe('DELETE /api/v1/admin/categories/:id', () => {
  it('returns 200 when category is deleted', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockPrisma.category.delete as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .delete(`/api/v1/admin/categories/${CAT_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('returns 404 when category does not exist', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .delete('/api/v1/admin/categories/nonexistent')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
  })
})
