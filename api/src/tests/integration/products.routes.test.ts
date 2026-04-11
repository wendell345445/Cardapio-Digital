// ─── TASK-041: Produtos CRUD Individual — Integration Tests ──────────────────

jest.mock('../../shared/prisma/prisma', () => ({
  prisma: {
    category: { findUnique: jest.fn() },
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    productVariation: { deleteMany: jest.fn() },
    productAdditional: { deleteMany: jest.fn() },
    store: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../shared/redis/redis', () => ({
  cache: { del: jest.fn(), get: jest.fn(), set: jest.fn() },
}))

jest.mock('../../shared/socket/socket', () => ({
  emit: { menuUpdated: jest.fn(), itemStatus: jest.fn() },
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
// Schemas Zod exigem UUID válido
const CATEGORY_ID = '22222222-2222-4222-8222-222222222222'
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333'

function adminToken(storeId = STORE_ID) {
  return sign({ userId: 'user-1', role: 'ADMIN', storeId }, 'test-secret')
}

const mockCategory = {
  id: CATEGORY_ID,
  storeId: STORE_ID,
  name: 'Pizzas',
  order: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockProduct = {
  id: PRODUCT_ID,
  storeId: STORE_ID,
  categoryId: CATEGORY_ID,
  name: 'Pizza Margherita',
  description: 'Clássica',
  imageUrl: 'https://res.cloudinary.com/test/image.jpg',
  basePrice: 35.9,
  isActive: true,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  variations: [],
  additionals: [],
}

beforeEach(() => {
  jest.resetAllMocks()
  // requireActiveStore faz prisma.store.findUnique → precisa retornar loja ACTIVE por default
  ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({ status: 'ACTIVE' })
  ;(mockPrisma.$transaction as jest.Mock).mockImplementation((input) => {
    if (typeof input === 'function') return input(mockPrisma)
    return Promise.all(input)
  })
})

// ─── GET /admin/products ──────────────────────────────────────────────────────

describe('GET /api/v1/admin/products', () => {
  it('returns 200 with product list', async () => {
    ;(mockPrisma.product.findMany as jest.Mock).mockResolvedValue([mockProduct])

    const res = await request(app)
      .get('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].name).toBe('Pizza Margherita')
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/admin/products')

    expect(res.status).toBe(401)
  })
})

// ─── GET /admin/products/:id ──────────────────────────────────────────────────

describe('GET /api/v1/admin/products/:id', () => {
  it('returns 200 with product details', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)

    const res = await request(app)
      .get(`/api/v1/admin/products/${PRODUCT_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(PRODUCT_ID)
  })

  it('returns 404 when product does not exist', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/v1/admin/products/nonexistent')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
  })
})

// ─── POST /admin/products ─────────────────────────────────────────────────────

describe('POST /api/v1/admin/products', () => {
  it('returns 201 when product is created (produto criado com variações e adicionais)', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.product.create as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        categoryId: CATEGORY_ID,
        name: 'Pizza Margherita',
        imageUrl: 'https://res.cloudinary.com/test/image.jpg',
        basePrice: 35.9,
        variations: [{ name: 'Grande', price: 45.9 }],
        additionals: [{ name: 'Borda Catupiry', price: 5.0 }],
      })

    expect(res.status).toBe(201)
    expect(res.body.data.id).toBe(PRODUCT_ID)
  })

  it('returns 422 when product name is duplicated in the store (nome duplicado → 422)', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue(mockProduct)

    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        categoryId: CATEGORY_ID,
        name: 'Pizza Margherita',
        imageUrl: 'https://res.cloudinary.com/test/image.jpg',
      })

    expect(res.status).toBe(422)
  })

  it('returns 400 when imageUrl is missing (RN-006: foto obrigatória)', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        categoryId: CATEGORY_ID,
        name: 'Pizza Margherita',
        // imageUrl is missing
      })

    expect(res.status).toBe(400)
  })

  it('returns 400 when name is too short', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        categoryId: CATEGORY_ID,
        name: 'X',
        imageUrl: 'https://res.cloudinary.com/test/image.jpg',
      })

    expect(res.status).toBe(400)
  })

  it('returns 404 when categoryId does not belong to the store', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        categoryId: '99999999-9999-4999-8999-999999999999',
        name: 'Pizza Nova',
        imageUrl: 'https://res.cloudinary.com/test/image.jpg',
      })

    expect(res.status).toBe(404)
  })
})

// ─── PATCH /admin/products/:id ────────────────────────────────────────────────

describe('PATCH /api/v1/admin/products/:id', () => {
  it('returns 200 when product is updated', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.product.update as jest.Mock).mockResolvedValue({ ...mockProduct, basePrice: 40.0 })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch(`/api/v1/admin/products/${PRODUCT_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ basePrice: 40.0 })

    expect(res.status).toBe(200)
    expect(res.body.data.basePrice).toBe(40.0)
  })

  it('returns 422 when updated name conflicts with another product', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue({
      ...mockProduct,
      id: 'prod-2',
      name: 'Pizza Calabresa',
    })

    const res = await request(app)
      .patch(`/api/v1/admin/products/${PRODUCT_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Pizza Calabresa' })

    expect(res.status).toBe(422)
  })

  it('returns 404 when product does not exist', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/v1/admin/products/nonexistent')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ basePrice: 40.0 })

    expect(res.status).toBe(404)
  })
})

// ─── DELETE /admin/products/:id ───────────────────────────────────────────────

describe('DELETE /api/v1/admin/products/:id', () => {
  it('returns 200 when product is deleted', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockPrisma.product.delete as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .delete(`/api/v1/admin/products/${PRODUCT_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('returns 404 when product does not exist', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .delete('/api/v1/admin/products/nonexistent')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
  })
})
