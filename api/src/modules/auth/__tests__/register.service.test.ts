// Mock prisma
jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    user: { findFirst: jest.fn(), create: jest.fn() },
    store: { findUnique: jest.fn() },
    refreshToken: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

// Mock asaas
jest.mock('../../../shared/asaas/asaas.service', () => ({
  createCustomer: jest.fn(),
  deleteCustomerSafe: jest.fn(),
}))

// Mock email
jest.mock('../../../shared/email/email.service', () => ({
  sendWelcomeSelfRegisterEmail: jest.fn(),
}))

import { prisma } from '../../../shared/prisma/prisma'
import { createCustomer, deleteCustomerSafe } from '../../../shared/asaas/asaas.service'
import { sendWelcomeSelfRegisterEmail } from '../../../shared/email/email.service'
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
  documentNumber: '24971563792',
  plan: 'PROFESSIONAL' as const,
}

const fakeStoreRow = {
  id: 'store-1',
  slug: 'pizzaria-dona-maria',
  trialEndsAt: new Date('2026-04-17T00:00:00Z'),
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
    const tx = {
      store: { create: jest.fn().mockResolvedValue(fakeStoreRow) },
      user: { create: jest.fn().mockResolvedValue(fakeUserRow) },
      businessHour: { createMany: jest.fn().mockResolvedValue({ count: 7 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    }
    return fn(tx)
  })
  ;(createCustomer as jest.Mock).mockResolvedValue({ id: 'cus_fake', email: 'x', name: 'x', cpfCnpj: null })
  ;(sendWelcomeSelfRegisterEmail as jest.Mock).mockResolvedValue(undefined)
})

describe('registerStore — happy path', () => {
  it('creates Asaas customer + Store + User + BusinessHours + AuditLog and emits tokens', async () => {
    const result = await registerStore(validInput, '127.0.0.1')

    expect(createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ name: validInput.storeName, email: validInput.email })
    )
    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
    expect(result.store.id).toBe('store-1')
    expect(result.store.slug).toBe('pizzaria-dona-maria')
  })

  it('persists asaasCustomerId + trialEndsAt no Store (trial local de 7 dias)', async () => {
    const txMock = mockPrisma.$transaction as jest.Mock
    txMock.mockImplementation(async (fn: any) => {
      const tx = {
        store: { create: jest.fn().mockResolvedValue(fakeStoreRow) },
        user: { create: jest.fn().mockResolvedValue(fakeUserRow) },
        businessHour: { createMany: jest.fn().mockResolvedValue({ count: 7 }) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      }
      const result = await fn(tx)
      const createArg = tx.store.create.mock.calls[0][0]
      expect(createArg.data.asaasCustomerId).toBe('cus_fake')
      expect(createArg.data.status).toBe('TRIAL')
      expect(createArg.data.trialEndsAt).toBeInstanceOf(Date)
      expect((createArg.data.trialEndsAt as Date).getTime()).toBeGreaterThan(Date.now())
      return result
    })
    await registerStore(validInput, '127.0.0.1')
  })
})

describe('registerStore — slug collision', () => {
  it('appends -2 when slug already exists', async () => {
    mockPrisma.store.findUnique
      .mockResolvedValueOnce({ id: 'existing', slug: 'pizzaria-dona-maria' })
      .mockResolvedValueOnce(null)

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

describe('registerStore — transaction fails', () => {
  it('calls deleteCustomerSafe and re-throws when the Prisma transaction throws', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('DB boom'))
    await expect(registerStore(validInput, '127.0.0.1')).rejects.toThrow('DB boom')
    expect(deleteCustomerSafe).toHaveBeenCalledWith('cus_fake')
  })
})

describe('registerStore — email failure does not block', () => {
  it('still returns 201-shaped result when sendWelcomeSelfRegisterEmail rejects', async () => {
    ;(sendWelcomeSelfRegisterEmail as jest.Mock).mockRejectedValue(new Error('SMTP down'))
    const result = await registerStore(validInput, '127.0.0.1')
    expect(result.accessToken).toBeDefined()
    await new Promise((r) => setImmediate(r))
  })
})
