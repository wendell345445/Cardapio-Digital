/**
 * Unit tests — Epic 02: owner.service.ts
 *
 * Covers:
 *  - TASK-020: listStores (filter by status, MRR calculation)
 *  - TASK-021: createStore (slug unique RN-001, email unique RN-002, Stripe + transaction)
 *  - TASK-022: getStore, updateStore, cancelStore
 *  - TASK-023: updateStorePlan (upgrade/downgrade, Stripe update)
 *  - TASK-024: getAuditLogs (pagination, filters)
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../../shared/prisma/prisma', () => ({
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

jest.mock('../../../shared/stripe/stripe.service', () => ({
  createCustomer: jest.fn(),
  createSubscription: jest.fn(),
  updateSubscription: jest.fn(),
  endSubscriptionTrialNow: jest.fn().mockResolvedValue({ id: 'sub_123', trial_end: 0 }),
  PLAN_PRICE_IDS: { PROFESSIONAL: 'price_pro', PREMIUM: 'price_prem' },
}))

jest.mock('../../../shared/email/email.service', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPlanChangeEmail: jest.fn().mockResolvedValue(undefined),
}))

const queueAdd = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../jobs/trial-suspension.job', () => ({
  getTrialSuspensionQueue: jest.fn(() => ({ add: queueAdd })),
}))

import { prisma } from '../../../shared/prisma/prisma'
import {
  createCustomer,
  createSubscription,
  endSubscriptionTrialNow,
  updateSubscription,
} from '../../../shared/stripe/stripe.service'
import { sendWelcomeEmail, sendPlanChangeEmail } from '../../../shared/email/email.service'
import {
  cancelStore,
  createStore,
  endTrialNow,
  getAuditLogs,
  getStore,
  listStores,
  updateStore,
  updateStorePlan,
} from '../owner.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

beforeEach(() => jest.clearAllMocks())

process.env.FRONTEND_URL = 'http://localhost:5173'

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
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const createInput = {
  name: 'Nova Loja',
  slug: 'nova-loja',
  plan: 'PROFESSIONAL' as const,
  adminEmail: 'admin@novaloja.com',
  whatsapp: '48999998877',
  adminName: 'João Admin',
}

// ─── TASK-020: listStores ─────────────────────────────────────────────────────

describe('listStores (TASK-020)', () => {
  it('returns stores list with MRR for active stores', async () => {
    const stores = [
      makeStore({ status: 'ACTIVE', plan: 'PROFESSIONAL' }),
      makeStore({ id: 'store-2', status: 'ACTIVE', plan: 'PREMIUM' }),
      makeStore({ id: 'store-3', status: 'TRIAL', plan: 'PROFESSIONAL' }),
    ]
    ;(mockPrisma.store.findMany as jest.Mock).mockResolvedValue(stores)

    const result = await listStores()

    expect(result.stores).toHaveLength(3)
    expect(result.mrr).toBe(99 + 149) // two active stores
    expect(result.stores[0].planMrr).toBe(99)
    expect(result.stores[2].planMrr).toBe(0) // TRIAL gets 0
  })

  it('passes status filter to prisma query', async () => {
    ;(mockPrisma.store.findMany as jest.Mock).mockResolvedValue([])

    await listStores('ACTIVE')

    expect(mockPrisma.store.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE' } })
    )
  })

  it('passes no where clause when status is undefined', async () => {
    ;(mockPrisma.store.findMany as jest.Mock).mockResolvedValue([])

    await listStores()

    expect(mockPrisma.store.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined })
    )
  })

  it('returns mrr 0 when no active stores', async () => {
    ;(mockPrisma.store.findMany as jest.Mock).mockResolvedValue([
      makeStore({ status: 'SUSPENDED' }),
    ])

    const result = await listStores()
    expect(result.mrr).toBe(0)
  })
})

// ─── TASK-021: createStore ────────────────────────────────────────────────────

describe('createStore (TASK-021)', () => {
  const mockStripeCustomer = { id: 'cus_new', email: 'admin@novaloja.com', name: 'Nova Loja' }
  const mockStripeSubscription = {
    id: 'sub_new',
    status: 'trialing',
    items: { data: [] },
    customer: 'cus_new',
    trial_end: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  }
  const newStore = makeStore({ id: 'store-new', slug: 'nova-loja', stripeCustomerId: 'cus_new' })

  beforeEach(() => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null) // slug free
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)  // email free
    ;(createCustomer as jest.Mock).mockResolvedValue(mockStripeCustomer)
    ;(createSubscription as jest.Mock).mockResolvedValue(mockStripeSubscription)
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) =>
      fn({
        store: { create: jest.fn().mockResolvedValue(newStore) },
        user: { create: jest.fn() },
        businessHour: { createMany: jest.fn() },
        auditLog: { create: jest.fn() },
      })
    )
  })

  it('creates store and returns it on happy path', async () => {
    const result = await createStore(createInput, 'owner-1')

    expect(result.id).toBe('store-new')
    expect(createCustomer).toHaveBeenCalledWith(createInput.adminEmail, createInput.name)
    expect(createSubscription).toHaveBeenCalledWith('cus_new', 'price_pro')
    expect(sendWelcomeEmail).toHaveBeenCalled()
  })

  it('throws 422 when slug is already taken (RN-001)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore())

    await expect(createStore(createInput, 'owner-1')).rejects.toMatchObject({ status: 422 })
  })

  it('throws 422 when adminEmail belongs to another store (RN-002)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-user' })

    await expect(createStore(createInput, 'owner-1')).rejects.toMatchObject({ status: 422 })
  })

  it('creates Stripe customer with correct email and name', async () => {
    await createStore(createInput, 'owner-1')

    expect(createCustomer).toHaveBeenCalledWith('admin@novaloja.com', 'Nova Loja')
  })

  it('creates Stripe subscription with PREMIUM price ID for PREMIUM plan', async () => {
    await createStore({ ...createInput, plan: 'PREMIUM' }, 'owner-1')

    expect(createSubscription).toHaveBeenCalledWith('cus_new', 'price_prem')
  })

  it('sends welcome email after store creation', async () => {
    await createStore(createInput, 'owner-1')

    expect(sendWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        adminEmail: 'admin@novaloja.com',
        storeName: 'Nova Loja',
      })
    )
  })
})

// ─── TASK-022: getStore ───────────────────────────────────────────────────────

describe('getStore (TASK-022)', () => {
  it('returns store with admin users and business hours', async () => {
    const store = { ...makeStore(), users: [], businessHours: [] }
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(store)

    const result = await getStore('store-1')

    expect(result.id).toBe('store-1')
    expect(mockPrisma.store.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'store-1' } })
    )
  })

  it('throws 404 when store does not exist', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(getStore('non-existent')).rejects.toMatchObject({ status: 404 })
  })
})

// ─── TASK-022: updateStore ────────────────────────────────────────────────────

describe('updateStore (TASK-022)', () => {
  it('updates store fields and creates audit log', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore())
    const updated = makeStore({ name: 'Novo Nome' })
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(updated)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updateStore('store-1', { name: 'Novo Nome' }, 'owner-1')

    expect(result.name).toBe('Novo Nome')
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'store-1' }, data: { name: 'Novo Nome' } })
    )
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'store.update', userId: 'owner-1' }),
      })
    )
  })

  it('throws 404 when store does not exist', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(updateStore('non-existent', { name: 'X' }, 'owner-1')).rejects.toMatchObject({
      status: 404,
    })
  })
})

// ─── TASK-022: cancelStore ────────────────────────────────────────────────────

describe('cancelStore (TASK-022)', () => {
  it('sets store status to CANCELLED', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore({ status: 'ACTIVE' }))
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore({ status: 'CANCELLED' }))
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await cancelStore('store-1', 'owner-1')

    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED' } })
    )
    expect(result.status).toBe('CANCELLED')
  })

  it('throws 404 when store does not exist', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(cancelStore('non-existent', 'owner-1')).rejects.toMatchObject({ status: 404 })
  })

  it('throws 422 when store is already CANCELLED', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore({ status: 'CANCELLED' }))

    await expect(cancelStore('store-1', 'owner-1')).rejects.toMatchObject({ status: 422 })
  })

  it('creates audit log with previousStatus', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore({ status: 'ACTIVE' }))
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore({ status: 'CANCELLED' }))
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await cancelStore('store-1', 'owner-1')

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'store.cancel',
          data: { previousStatus: 'ACTIVE' },
        }),
      })
    )
  })
})

// ─── TASK-023: updateStorePlan ────────────────────────────────────────────────

describe('updateStorePlan (TASK-023)', () => {
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

  it('upgrades plan to PREMIUM and updates Stripe subscription', async () => {
    const result = await updateStorePlan('store-1', { plan: 'PREMIUM' }, 'owner-1')

    expect(updateSubscription).toHaveBeenCalledWith('sub_123', 'price_prem')
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: 'PREMIUM' }),
      })
    )
    expect(result.plan).toBe('PREMIUM')
  })

  it('sets PREMIUM feature flags on upgrade', async () => {
    await updateStorePlan('store-1', { plan: 'PREMIUM' }, 'owner-1')

    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          features: expect.objectContaining({ aiAssistant: true, deliveryZones: true }),
        }),
      })
    )
  })

  it('sets PROFESSIONAL feature flags on downgrade', async () => {
    const premiumStore = {
      ...makeStore({ plan: 'PREMIUM' }),
      users: [{ email: 'admin@loja.com', name: 'Admin' }],
    }
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(premiumStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore({ plan: 'PROFESSIONAL' }))

    await updateStorePlan('store-1', { plan: 'PROFESSIONAL' }, 'owner-1')

    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          features: expect.objectContaining({ aiAssistant: false, coupons: false }),
        }),
      })
    )
  })

  it('throws 404 when store does not exist', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(updateStorePlan('non-existent', { plan: 'PREMIUM' }, 'owner-1')).rejects.toMatchObject(
      { status: 404 }
    )
  })

  it('throws 422 when store is already on the requested plan', async () => {
    await expect(
      updateStorePlan('store-1', { plan: 'PROFESSIONAL' }, 'owner-1')
    ).rejects.toMatchObject({ status: 422 })
  })

  it('sends plan change email to admin', async () => {
    await updateStorePlan('store-1', { plan: 'PREMIUM' }, 'owner-1')

    expect(sendPlanChangeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        adminEmail: 'admin@loja.com',
        oldPlan: 'PROFESSIONAL',
        newPlan: 'PREMIUM',
      })
    )
  })

  it('creates audit log with oldPlan and newPlan', async () => {
    await updateStorePlan('store-1', { plan: 'PREMIUM' }, 'owner-1')

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'store.plan.update',
          data: { oldPlan: 'PROFESSIONAL', newPlan: 'PREMIUM' },
        }),
      })
    )
  })

  it('skips Stripe update when store has no subscription', async () => {
    const storeNoSub = { ...storeWithAdmin, stripeSubscriptionId: null }
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(storeNoSub)

    await updateStorePlan('store-1', { plan: 'PREMIUM' }, 'owner-1')

    expect(updateSubscription).not.toHaveBeenCalled()
  })
})

// ─── OWNER TOOL: endTrialNow ──────────────────────────────────────────────────

describe('endTrialNow (owner tool)', () => {
  const trialStore = makeStore({ status: 'TRIAL', stripeSubscriptionId: 'sub_123' })

  beforeEach(() => {
    queueAdd.mockClear()
    ;(endSubscriptionTrialNow as jest.Mock).mockClear()
    ;(endSubscriptionTrialNow as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(trialStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})
  })

  it('encerra trial no Stripe + força stripeTrialEndsAt no passado + enfileira sweep + cria audit log', async () => {
    const result = await endTrialNow('store-1', 'owner-1', '127.0.0.1')

    expect(endSubscriptionTrialNow).toHaveBeenCalledWith('sub_123')
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'store-1' },
        data: expect.objectContaining({ stripeTrialEndsAt: expect.any(Date) }),
      })
    )
    // stripeTrialEndsAt deve ser no passado pra sweep pegar imediatamente
    const updateCall = (mockPrisma.store.update as jest.Mock).mock.calls[0][0]
    expect((updateCall.data.stripeTrialEndsAt as Date).getTime()).toBeLessThan(Date.now())
    expect(queueAdd).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ removeOnComplete: true })
    )
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'store.trial.ended.dev',
          userId: 'owner-1',
          storeId: 'store-1',
        }),
      })
    )
    expect(result.ok).toBe(true)
  })

  it('segue o fluxo mesmo quando Stripe API falha (best-effort)', async () => {
    ;(endSubscriptionTrialNow as jest.Mock).mockRejectedValue(
      new Error('no attached payment source')
    )

    const result = await endTrialNow('store-1', 'owner-1')

    // Stripe call foi tentado mas falhou — o fluxo NÃO aborta
    expect(endSubscriptionTrialNow).toHaveBeenCalledWith('sub_123')
    // Local update + queue + audit log ainda rodam
    expect(mockPrisma.store.update).toHaveBeenCalled()
    expect(queueAdd).toHaveBeenCalled()
    expect(mockPrisma.auditLog.create).toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })

  it('pula a chamada Stripe quando loja não tem stripeSubscriptionId (update local ainda roda)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(
      makeStore({ status: 'TRIAL', stripeSubscriptionId: null })
    )

    const result = await endTrialNow('store-1', 'owner-1')

    expect(endSubscriptionTrialNow).not.toHaveBeenCalled()
    expect(mockPrisma.store.update).toHaveBeenCalled()
    expect(queueAdd).toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })

  it('joga 404 quando loja não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(endTrialNow('non-existent', 'owner-1')).rejects.toMatchObject({ status: 404 })
    expect(endSubscriptionTrialNow).not.toHaveBeenCalled()
    expect(queueAdd).not.toHaveBeenCalled()
  })

  it('joga 422 quando loja não está em TRIAL', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(
      makeStore({ status: 'ACTIVE' })
    )
    await expect(endTrialNow('store-1', 'owner-1')).rejects.toMatchObject({ status: 422 })
    expect(endSubscriptionTrialNow).not.toHaveBeenCalled()
  })
})

// ─── TASK-024: getAuditLogs ───────────────────────────────────────────────────

describe('getAuditLogs (TASK-024)', () => {
  const mockLogs = [
    { id: 'log-1', action: 'store.create', createdAt: new Date(), user: { id: 'owner-1', email: 'owner@sys.com', name: 'Owner', role: 'OWNER' } },
  ]

  beforeEach(() => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs)
    ;(mockPrisma.auditLog.count as jest.Mock).mockResolvedValue(1)
  })

  it('returns logs with pagination metadata', async () => {
    const result = await getAuditLogs('store-1', { page: 1, limit: 20 })

    expect(result.logs).toHaveLength(1)
    expect(result.pagination).toMatchObject({ page: 1, limit: 20, total: 1, pages: 1 })
  })

  it('throws 404 when store does not exist', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(getAuditLogs('non-existent', { page: 1, limit: 20 })).rejects.toMatchObject({
      status: 404,
    })
  })

  it('calculates skip correctly for page 2', async () => {
    await getAuditLogs('store-1', { page: 2, limit: 10 })

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    )
  })

  it('applies action filter when provided', async () => {
    await getAuditLogs('store-1', { page: 1, limit: 20, action: 'store.create' })

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: { contains: 'store.create' } }),
      })
    )
  })

  it('applies userId filter when provided', async () => {
    await getAuditLogs('store-1', { page: 1, limit: 20, userId: 'owner-1' })

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'owner-1' }),
      })
    )
  })

  it('applies date range filter when from and to provided', async () => {
    const from = new Date('2024-01-01')
    const to = new Date('2024-12-31')

    await getAuditLogs('store-1', { page: 1, limit: 20, from, to })

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: from, lte: to },
        }),
      })
    )
  })

  it('calculates pages correctly for multi-page results', async () => {
    ;(mockPrisma.auditLog.count as jest.Mock).mockResolvedValue(45)

    const result = await getAuditLogs('store-1', { page: 1, limit: 20 })

    expect(result.pagination.pages).toBe(3) // ceil(45/20)
  })
})
