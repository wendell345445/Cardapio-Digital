// Mock prisma
jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    user: { findFirst: jest.fn(), create: jest.fn() },
    store: { findUnique: jest.fn() },
    refreshToken: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

// Mock stripe
jest.mock('../../../shared/stripe/stripe.service', () => ({
  PLAN_PRICE_IDS: { PROFESSIONAL: 'price_pro_fake', PREMIUM: 'price_premium_fake' },
  createCustomer: jest.fn(),
  createSubscription: jest.fn(),
  cancelCustomerSafe: jest.fn(),
}))

// Mock email
jest.mock('../../../shared/email/email.service', () => ({
  sendWelcomeSelfRegisterEmail: jest.fn(),
}))

import { prisma } from '../../../shared/prisma/prisma'
import { sendWelcomeSelfRegisterEmail } from '../../../shared/email/email.service'
import {
  cancelCustomerSafe,
  createCustomer,
  createSubscription,
} from '../../../shared/stripe/stripe.service'
import { registerStore } from '../register.service'

const mockPrisma = prisma as unknown as {
  user: { findFirst: jest.Mock; create: jest.Mock }
  store: { findUnique: jest.Mock }
  refreshToken: { create: jest.Mock }
  $transaction: jest.Mock
}

process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

const validInput = {
  storeName: 'Pizzaria Dona Maria',
  segment: 'PIZZERIA' as const,
  email: 'dona.maria@example.com',
  password: 'senha1234',
  confirmPassword: 'senha1234',
  whatsapp: '48999990000',
  plan: 'PROFESSIONAL' as const,
}

const fakeStoreRow = {
  id: 'store-1',
  slug: 'pizzaria-dona-maria',
  stripeTrialEndsAt: new Date('2026-04-17T00:00:00Z'),
}

const fakeUserRow = {
  id: 'user-1',
  email: 'dona.maria@example.com',
  role: 'ADMIN',
  storeId: 'store-1',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.user.findFirst.mockResolvedValue(null)
  mockPrisma.store.findUnique.mockResolvedValue(null)
  mockPrisma.refreshToken.create.mockResolvedValue({})
  mockPrisma.$transaction.mockImplementation(async (fn: any) => {
    // Provide a tx mock that mirrors the operations registerStore performs
    const tx = {
      store: { create: jest.fn().mockResolvedValue(fakeStoreRow) },
      user: { create: jest.fn().mockResolvedValue(fakeUserRow) },
      businessHour: { createMany: jest.fn().mockResolvedValue({ count: 7 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    }
    return fn(tx)
  })
  ;(createCustomer as jest.Mock).mockResolvedValue({ id: 'cus_fake', email: 'x', name: 'x' })
  ;(createSubscription as jest.Mock).mockResolvedValue({
    id: 'sub_fake',
    status: 'trialing',
    items: { data: [] },
    customer: 'cus_fake',
    trial_end: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  })
  ;(sendWelcomeSelfRegisterEmail as jest.Mock).mockResolvedValue(undefined)
})

describe('registerStore — happy path', () => {
  it('creates Store + User + BusinessHours + AuditLog and emits tokens', async () => {
    const result = await registerStore(validInput, '127.0.0.1')

    expect(createCustomer).toHaveBeenCalled()
    expect(createSubscription).toHaveBeenCalledWith('cus_fake', 'price_pro_fake')
    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
    expect(result.store.id).toBe('store-1')
    expect(result.store.slug).toBe('pizzaria-dona-maria')
  })
})

describe('registerStore — slug collision', () => {
  it('appends -2 when slug already exists', async () => {
    mockPrisma.store.findUnique
      .mockResolvedValueOnce({ id: 'existing', slug: 'pizzaria-dona-maria' }) // first try collides
      .mockResolvedValueOnce(null) // -2 is free

    const txMock = mockPrisma.$transaction as jest.Mock
    txMock.mockImplementation(async (fn: any) => {
      const tx = {
        store: {
          create: jest.fn().mockResolvedValue({ ...fakeStoreRow, slug: 'pizzaria-dona-maria-2' }),
        },
        user: { create: jest.fn().mockResolvedValue(fakeUserRow) },
        businessHour: { createMany: jest.fn().mockResolvedValue({ count: 7 }) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      }
      const result = await fn(tx)
      // assert that the slug used by store.create is the -2 variant
      expect(tx.store.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'pizzaria-dona-maria-2' }) })
      )
      return result
    })

    const result = await registerStore(validInput, '127.0.0.1')
    expect(result.store.slug).toBe('pizzaria-dona-maria-2')
  })
})

describe('registerStore — reserved slug (RN-001C)', () => {
  it('appends -2 when the store name normalizes to a reserved slug (ex: "API")', async () => {
    // Nome "API" → slugify → "api" (reservado). Deve cair no sufixo -2.
    // findUnique só é chamado pro candidate não-reservado (api-2),
    // que está livre → retorna null.
    mockPrisma.store.findUnique.mockResolvedValue(null)

    const txMock = mockPrisma.$transaction as jest.Mock
    txMock.mockImplementation(async (fn: any) => {
      const tx = {
        store: {
          create: jest.fn().mockResolvedValue({ ...fakeStoreRow, slug: 'api-2' }),
        },
        user: { create: jest.fn().mockResolvedValue(fakeUserRow) },
        businessHour: { createMany: jest.fn().mockResolvedValue({ count: 7 }) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      }
      const result = await fn(tx)
      expect(tx.store.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'api-2' }) })
      )
      return result
    })

    const result = await registerStore({ ...validInput, storeName: 'API' }, '127.0.0.1')
    expect(result.store.slug).toBe('api-2')
    // findUnique deve ter sido chamado só com o candidate não-reservado
    expect(mockPrisma.store.findUnique).toHaveBeenCalledWith({ where: { slug: 'api-2' } })
    expect(mockPrisma.store.findUnique).not.toHaveBeenCalledWith({ where: { slug: 'api' } })
  })
})

describe('registerStore — duplicate email', () => {
  it('throws AppError 422 when email already exists', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing', email: validInput.email })
    await expect(registerStore(validInput, '127.0.0.1')).rejects.toThrow('Email já cadastrado')
    expect(createCustomer).not.toHaveBeenCalled()
  })
})

describe('registerStore — Stripe subscription fails', () => {
  it('calls cancelCustomerSafe and re-throws', async () => {
    ;(createSubscription as jest.Mock).mockRejectedValue(new Error('Stripe boom'))
    await expect(registerStore(validInput, '127.0.0.1')).rejects.toThrow('Stripe boom')
    expect(cancelCustomerSafe).toHaveBeenCalledWith('cus_fake')
  })
})

describe('registerStore — email failure does not block', () => {
  it('still returns 201-shaped result when sendWelcomeSelfRegisterEmail rejects', async () => {
    ;(sendWelcomeSelfRegisterEmail as jest.Mock).mockRejectedValue(new Error('SMTP down'))

    // Should NOT throw — fire-and-forget
    const result = await registerStore(validInput, '127.0.0.1')
    expect(result.accessToken).toBeDefined()
    // Wait one tick for the .catch to run
    await new Promise((r) => setImmediate(r))
  })
})
