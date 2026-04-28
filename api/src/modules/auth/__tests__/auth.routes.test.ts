import { hash } from 'bcrypt'
import request from 'supertest'

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
  },
}))

// Suppress passport config during tests
jest.mock('../passport.config', () => ({
  configurePassport: jest.fn(),
  isOAuthProviderEnabled: jest.fn((provider: 'google' | 'facebook') => {
    if (provider === 'google') {
      return (
        process.env.GOOGLE_APP_ENABLE === 'true' &&
        !!process.env.GOOGLE_APP_ID &&
        !!process.env.GOOGLE_APP_SECRET
      )
    }
    return (
      process.env.FACEBOOK_APP_ENABLE === 'true' &&
      !!process.env.FACEBOOK_APP_ID &&
      !!process.env.FACEBOOK_APP_SECRET
    )
  }),
}))

// Mock register.service so integration tests don't need Stripe / email
jest.mock('../register.service', () => ({
  registerStore: jest.fn(),
}))

import { app } from '../../../app'
import { prisma } from '../../../shared/prisma/prisma'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

let passwordHash: string

beforeAll(async () => {
  passwordHash = await hash('password123', 12)
})

beforeEach(() => jest.clearAllMocks())

const mockUser = () => ({
  id: 'user-1',
  email: 'admin@loja.com',
  name: 'Admin',
  role: 'ADMIN',
  storeId: 'store-1',
  isActive: true,
  passwordHash,
  whatsapp: null,
  googleId: null,
  facebookId: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
})

describe('POST /api/v1/auth/login', () => {
  it('returns 200 with tokens on valid credentials', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser())
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue(mockUser())
    ;(mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@loja.com', password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body.data.accessToken).toBeDefined()
    expect(res.body.data.refreshToken).toBeDefined()
    expect(res.body.data.user.role).toBe('ADMIN')
  })

  it('returns 401 on invalid credentials', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'no@user.com', password: 'wrong' })

    expect(res.status).toBe(401)
  })

  it('returns 400 on missing fields', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'only@email.com' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/v1/auth/refresh', () => {
  it('returns new access token', async () => {
    const { sign } = require('jsonwebtoken')
    const refreshToken = sign({ userId: 'user-1' }, 'test-refresh-secret', { expiresIn: '7d' })

    ;(mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      user: mockUser(),
    })

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })

    expect(res.status).toBe(200)
    expect(res.body.data.accessToken).toBeDefined()
  })
})

describe('POST /api/v1/auth/logout', () => {
  it('returns 200 and deletes refresh token', async () => {
    ;(mockPrisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'some-token' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalled()
  })
})

describe('POST /api/v1/auth/reauth', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reauth')
      .send({ password: 'password123' })

    expect(res.status).toBe(401)
  })

  it('returns 200 with valid JWT and correct password', async () => {
    const { sign } = require('jsonwebtoken')
    const token = sign({ userId: 'user-1', role: 'ADMIN', storeId: 'store-1' }, 'test-secret')
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser())

    const res = await request(app)
      .post('/api/v1/auth/reauth')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('returns 401 with valid JWT and wrong password', async () => {
    const { sign } = require('jsonwebtoken')
    const token = sign({ userId: 'user-1', role: 'ADMIN', storeId: 'store-1' }, 'test-secret')
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser())

    const res = await request(app)
      .post('/api/v1/auth/reauth')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'wrong-password' })

    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/auth/register-store', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerStore } = require('../register.service') as {
    registerStore: jest.Mock
  }

  const validBody = {
    storeName: 'Pizzaria Dona Maria',
    segment: 'PIZZERIA',
    email: 'dona.maria-rl-test@example.com',
    password: 'senha1234',
    confirmPassword: 'senha1234',
    whatsapp: '48999990000',
  }

  beforeEach(() => {
    registerStore.mockReset()
    registerStore.mockResolvedValue({
      accessToken: 'fake-access',
      refreshToken: 'fake-refresh',
      store: {
        id: 'store-1',
        slug: 'pizzaria-dona-maria',
        trialEndsAt: new Date('2026-04-17T00:00:00Z'),
      },
    })
  })

  it('returns 201 with tokens on happy path', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register-store')
      .set('X-Forwarded-For', '10.0.0.1')
      .send(validBody)

    expect(res.status).toBe(201)
    expect(res.body.accessToken).toBe('fake-access')
    expect(res.body.refreshToken).toBe('fake-refresh')
    expect(res.body.store.slug).toBe('pizzaria-dona-maria')
  })

  it('returns 400 (Zod) when passwords do not match', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register-store')
      .set('X-Forwarded-For', '10.0.0.2')
      .send({ ...validBody, confirmPassword: 'outra-senha' })

    expect(res.status).toBe(400)
  })

  it('returns 429 on the 6th request from the same IP', async () => {
    const ip = '10.0.0.99'
    // 5 successful requests
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/auth/register-store')
        .set('X-Forwarded-For', ip)
        .send({ ...validBody, email: `rl-${i}@example.com` })
      expect([201, 422]).toContain(res.status)
    }
    // 6th request: blocked
    const blocked = await request(app)
      .post('/api/v1/auth/register-store')
      .set('X-Forwarded-For', ip)
      .send({ ...validBody, email: 'rl-6@example.com' })
    expect(blocked.status).toBe(429)
  })
})

describe('GET /api/v1/auth/config', () => {
  const ORIGINAL_ENV = process.env

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('returns both providers true when both enabled', async () => {
    process.env.GOOGLE_APP_ENABLE = 'true'
    process.env.GOOGLE_APP_ID = 'g-id'
    process.env.GOOGLE_APP_SECRET = 'g-sec'
    process.env.FACEBOOK_APP_ENABLE = 'true'
    process.env.FACEBOOK_APP_ID = 'f-id'
    process.env.FACEBOOK_APP_SECRET = 'f-sec'

    const res = await request(app).get('/api/v1/auth/config')

    expect(res.status).toBe(200)
    expect(res.body.providers).toEqual({ google: true, facebook: true })
    expect(res.headers['cache-control']).toContain('max-age=300')
  })

  it('returns google true / facebook false when only google enabled', async () => {
    process.env.GOOGLE_APP_ENABLE = 'true'
    process.env.GOOGLE_APP_ID = 'g-id'
    process.env.GOOGLE_APP_SECRET = 'g-sec'
    process.env.FACEBOOK_APP_ENABLE = 'false'
    process.env.FACEBOOK_APP_ID = 'f-id'
    process.env.FACEBOOK_APP_SECRET = 'f-sec'

    const res = await request(app).get('/api/v1/auth/config')

    expect(res.status).toBe(200)
    expect(res.body.providers).toEqual({ google: true, facebook: false })
  })

  it('returns both false when both disabled', async () => {
    process.env.GOOGLE_APP_ENABLE = 'false'
    process.env.FACEBOOK_APP_ENABLE = 'false'

    const res = await request(app).get('/api/v1/auth/config')

    expect(res.status).toBe(200)
    expect(res.body.providers).toEqual({ google: false, facebook: false })
  })
})

describe('GET /api/v1/auth/client-token/:token', () => {
  it('returns 200 with order data for valid token', async () => {
    const { sign } = require('jsonwebtoken')
    const clientToken = sign({ orderId: 'order-abc', type: 'client' }, 'test-secret', {
      expiresIn: '24h',
    })

    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      id: 'order-abc',
      items: [],
      store: { name: 'Loja Teste', slug: 'loja-teste', phone: '999' },
    })

    const res = await request(app).get(`/api/v1/auth/client-token/${clientToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.order.id).toBe('order-abc')
    expect(res.body.data.clientToken).toBe(clientToken)
  })

  it('returns 401 for invalid/expired client token', async () => {
    const res = await request(app).get('/api/v1/auth/client-token/invalid-token')

    expect(res.status).toBe(401)
  })

  it('returns 404 when order is not found', async () => {
    const { sign } = require('jsonwebtoken')
    const clientToken = sign({ orderId: 'order-missing', type: 'client' }, 'test-secret', {
      expiresIn: '24h',
    })

    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app).get(`/api/v1/auth/client-token/${clientToken}`)

    expect(res.status).toBe(404)
  })
})
