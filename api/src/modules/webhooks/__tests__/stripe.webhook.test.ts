/**
 * Unit tests — Epic 02: stripe.webhook.ts (TASK-030)
 *
 * Covers:
 *  - Missing/invalid stripe-signature → 400
 *  - payment_intent.succeeded → Store.status = ACTIVE + AuditLog
 *  - invoice.payment_failed → stripeTrialEndsAt += STRIPE_GRACE_PERIOD_DAYS + email + AuditLog
 *  - customer.subscription.updated → plan + features update + AuditLog
 *  - customer.subscription.deleted → Store.status = SUSPENDED + AuditLog
 *  - customer.updated → reativa loja SUSPENDED após PM anexado via Customer Portal (v2.5.7)
 *  - Unknown event type → ignored gracefully
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    store: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}))

jest.mock('../../../shared/stripe/stripe.service', () => ({
  constructWebhookEvent: jest.fn(),
  PLAN_PRICE_IDS: { PROFESSIONAL: 'price_pro', PREMIUM: 'price_prem' },
  retrieveSubscription: jest.fn(),
  setSubscriptionDefaultPaymentMethod: jest.fn(),
  payInvoice: jest.fn(),
}))

jest.mock('../../../shared/email/email.service', () => ({
  sendPaymentFailedEmail: jest.fn().mockResolvedValue(undefined),
  sendTrialEndingEmail: jest.fn().mockResolvedValue(undefined),
}))

import { NextFunction, Request, Response } from 'express'

import { prisma } from '../../../shared/prisma/prisma'
import {
  constructWebhookEvent,
  payInvoice,
  retrieveSubscription,
  setSubscriptionDefaultPaymentMethod,
} from '../../../shared/stripe/stripe.service'
import { sendPaymentFailedEmail } from '../../../shared/email/email.service'
import { stripeWebhookController } from '../stripe.webhook'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    headers: { 'stripe-signature': 'valid-sig' },
    body: Buffer.from('{}'),
    ...overrides,
  }
}

function makeRes(): Partial<Response> & { jsonData?: unknown } {
  const res: Partial<Response> & { jsonData?: unknown } = {}
  res.json = jest.fn((data) => { res.jsonData = data; return res as Response })
  return res
}

function makeNext(): NextFunction {
  return jest.fn() as NextFunction
}

const makeStore = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'store-1',
  name: 'Loja Test',
  status: 'ACTIVE',
  plan: 'PROFESSIONAL',
  stripeCustomerId: 'cus_123',
  features: {},
  users: [{ email: 'admin@loja.com' }],
  ...overrides,
})

beforeEach(() => jest.clearAllMocks())

// ─── Signature validation ─────────────────────────────────────────────────────

describe('Stripe webhook — signature validation (TASK-030)', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const req = makeReq({ headers: {} })
    const res = makeRes()
    const next = makeNext()

    await stripeWebhookController(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }))
  })

  it('returns 400 when signature is invalid', async () => {
    ;(constructWebhookEvent as jest.Mock).mockImplementationOnce(() => {
      throw new Error('No signatures found matching the expected signature')
    })

    const req = makeReq()
    const res = makeRes()
    const next = makeNext()

    await stripeWebhookController(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }))
  })
})

// ─── payment_intent.succeeded ─────────────────────────────────────────────────

describe('payment_intent.succeeded (TASK-030)', () => {
  it('sets store status to ACTIVE', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_123', customer: 'cus_123' } },
    })
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(makeStore({ status: 'TRIAL' }))
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore({ status: 'ACTIVE' }))
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const req = makeReq()
    const res = makeRes()
    const next = makeNext()

    await stripeWebhookController(req as Request, res as Response, next)

    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACTIVE' } })
    )
    expect(res.jsonData).toEqual({ received: true })
  })

  it('creates audit log with store.payment.succeeded action', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_456', customer: 'cus_123' } },
    })
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'store.payment.succeeded' }),
      })
    )
  })

  it('does nothing when no store found for customer', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_789', customer: 'cus_unknown' } },
    })
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(null)

    const next = makeNext()
    await stripeWebhookController(makeReq() as Request, makeRes() as Response, next)

    expect(mockPrisma.store.update).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })
})

// ─── invoice.payment_failed ───────────────────────────────────────────────────

describe('invoice.payment_failed (TASK-030)', () => {
  it('sets stripeTrialEndsAt to NOW + STRIPE_GRACE_PERIOD_DAYS', async () => {
    // STRIPE_GRACE_PERIOD_DAYS default = 1 (lido no topo do módulo; como o módulo já foi importado,
    // o default vigente nesta execução é aceito). Assertamos dentro de uma janela tolerante.
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      type: 'invoice.payment_failed',
      data: { object: { id: 'inv_123', customer: 'cus_123' } },
    })
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const graceDays = Number(process.env.STRIPE_GRACE_PERIOD_DAYS ?? 1)

    const before = Date.now()
    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())
    const after = Date.now()

    const call = (mockPrisma.store.update as jest.Mock).mock.calls[0][0]
    const suspendAt: Date = call.data.stripeTrialEndsAt

    const expectedMin = new Date(before + graceDays * 24 * 60 * 60 * 1000 - 1000)
    const expectedMax = new Date(after + graceDays * 24 * 60 * 60 * 1000 + 1000)

    expect(suspendAt.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime())
    expect(suspendAt.getTime()).toBeLessThanOrEqual(expectedMax.getTime())
  })

  it('sends payment failed email to admin', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      type: 'invoice.payment_failed',
      data: { object: { id: 'inv_123', customer: 'cus_123' } },
    })
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(sendPaymentFailedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        adminEmail: 'admin@loja.com',
        storeName: 'Loja Test',
        graceDays: expect.any(Number),
      })
    )
  })

  it('creates audit log with store.payment.failed action', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      type: 'invoice.payment_failed',
      data: { object: { id: 'inv_999', customer: 'cus_123' } },
    })
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'store.payment.failed' }),
      })
    )
  })
})

// ─── customer.subscription.updated ───────────────────────────────────────────

describe('customer.subscription.updated (TASK-030)', () => {
  it('updates plan and feature flags when subscription is active', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          items: { data: [{ price: { id: 'price_prem' } }] },
        },
      },
    })
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore({ plan: 'PREMIUM' }))
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plan: 'PREMIUM',
          features: expect.objectContaining({ aiAssistant: true }),
          status: 'ACTIVE',
        }),
      })
    )
  })

  it('does NOT set status ACTIVE when subscription is not active', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'past_due',
          items: { data: [{ price: { id: 'price_pro' } }] },
        },
      },
    })
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    const updateCall = (mockPrisma.store.update as jest.Mock).mock.calls[0][0]
    expect(updateCall.data.status).toBeUndefined()
  })

  it('ignores event when priceId does not match any known plan', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_123',
          status: 'active',
          items: { data: [{ price: { id: 'price_unknown' } }] },
        },
      },
    })
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(makeStore())

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(mockPrisma.store.update).not.toHaveBeenCalled()
  })

  it('creates audit log with store.subscription.updated action', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          items: { data: [{ price: { id: 'price_pro' } }] },
        },
      },
    })
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'store.subscription.updated' }),
      })
    )
  })
})

// ─── customer.subscription.deleted ───────────────────────────────────────────

describe('customer.subscription.deleted (TASK-030)', () => {
  it('sets store status to SUSPENDED', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_123', customer: 'cus_123' } },
    })
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(makeStore({ status: 'ACTIVE' }))
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore({ status: 'SUSPENDED' }))
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = makeRes()
    await stripeWebhookController(makeReq() as Request, res as Response, makeNext())

    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'SUSPENDED' } })
    )
    expect(res.jsonData).toEqual({ received: true })
  })

  it('creates audit log with store.subscription.deleted action', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_del', customer: 'cus_123' } },
    })
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore())
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'store.subscription.deleted' }),
      })
    )
  })
})

// ─── customer.updated (v2.5.7 — recovery após PM anexado via Customer Portal) ─

describe('customer.updated — reativação de loja SUSPENDED (v2.5.7)', () => {
  const makeCustomerUpdatedEvent = (
    newDefaultPM: string | null,
    oldDefaultPM: string | null = null
  ) => ({
    type: 'customer.updated',
    data: {
      object: {
        id: 'cus_123',
        invoice_settings: { default_payment_method: newDefaultPM },
      },
      previous_attributes: {
        invoice_settings: { default_payment_method: oldDefaultPM },
      },
    },
  })

  it('ignora quando default PM não mudou', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue(
      makeCustomerUpdatedEvent('pm_123', 'pm_123')
    )

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(mockPrisma.store.findFirst).not.toHaveBeenCalled()
    expect(retrieveSubscription).not.toHaveBeenCalled()
  })

  it('ignora quando default PM é null (PM removido, não adicionado)', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue(
      makeCustomerUpdatedEvent(null, 'pm_old')
    )

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(mockPrisma.store.findFirst).not.toHaveBeenCalled()
  })

  it('ignora quando store não está SUSPENDED', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue(
      makeCustomerUpdatedEvent('pm_new')
    )
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(
      makeStore({ status: 'ACTIVE' })
    )

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(retrieveSubscription).not.toHaveBeenCalled()
    expect(mockPrisma.store.update).not.toHaveBeenCalled()
  })

  it('sincroniza loja para ACTIVE quando sub Stripe já está active', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue(
      makeCustomerUpdatedEvent('pm_new')
    )
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(
      makeStore({ status: 'SUSPENDED', stripeSubscriptionId: 'sub_123' })
    )
    ;(retrieveSubscription as jest.Mock).mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      latest_invoice: 'in_1',
    })
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue(makeStore({ status: 'ACTIVE' }))
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(retrieveSubscription).toHaveBeenCalledWith('sub_123')
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'ACTIVE', stripeTrialEndsAt: null },
      })
    )
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'store.reactivated' }),
      })
    )
    // Não chama payInvoice quando sub já está ativa
    expect(payInvoice).not.toHaveBeenCalled()
  })

  it('seta default PM na sub e paga invoice quando sub está incomplete', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue(
      makeCustomerUpdatedEvent('pm_new')
    )
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(
      makeStore({ status: 'SUSPENDED', stripeSubscriptionId: 'sub_123' })
    )
    ;(retrieveSubscription as jest.Mock).mockResolvedValue({
      id: 'sub_123',
      status: 'incomplete',
      latest_invoice: 'in_42',
    })
    ;(setSubscriptionDefaultPaymentMethod as jest.Mock).mockResolvedValue({})
    ;(payInvoice as jest.Mock).mockResolvedValue({ id: 'in_42', paid: true })

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(setSubscriptionDefaultPaymentMethod).toHaveBeenCalledWith('sub_123', 'pm_new')
    expect(payInvoice).toHaveBeenCalledWith('in_42')
    // Não atualiza store local — fica pro handler de customer.subscription.updated
    expect(mockPrisma.store.update).not.toHaveBeenCalled()
  })

  it('paga invoice também quando sub está past_due', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue(
      makeCustomerUpdatedEvent('pm_new')
    )
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(
      makeStore({ status: 'SUSPENDED', stripeSubscriptionId: 'sub_123' })
    )
    ;(retrieveSubscription as jest.Mock).mockResolvedValue({
      id: 'sub_123',
      status: 'past_due',
      latest_invoice: 'in_99',
    })
    ;(setSubscriptionDefaultPaymentMethod as jest.Mock).mockResolvedValue({})
    ;(payInvoice as jest.Mock).mockResolvedValue({ id: 'in_99', paid: true })

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(payInvoice).toHaveBeenCalledWith('in_99')
  })

  it('falha graceful (não relança) quando payInvoice rejeita', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue(
      makeCustomerUpdatedEvent('pm_new')
    )
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(
      makeStore({ status: 'SUSPENDED', stripeSubscriptionId: 'sub_123' })
    )
    ;(retrieveSubscription as jest.Mock).mockResolvedValue({
      id: 'sub_123',
      status: 'incomplete',
      latest_invoice: 'in_bad',
    })
    ;(setSubscriptionDefaultPaymentMethod as jest.Mock).mockResolvedValue({})
    ;(payInvoice as jest.Mock).mockRejectedValue(new Error('card_declined'))

    const res = makeRes()
    const next = makeNext()
    await stripeWebhookController(makeReq() as Request, res as Response, next)

    // Webhook responde 200 mesmo com falha de recovery (Stripe não retenta)
    expect(res.jsonData).toEqual({ received: true })
    expect(next).not.toHaveBeenCalled()
  })

  it('ignora quando store SUSPENDED não tem stripeSubscriptionId', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue(
      makeCustomerUpdatedEvent('pm_new')
    )
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(
      makeStore({ status: 'SUSPENDED', stripeSubscriptionId: null })
    )

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(retrieveSubscription).not.toHaveBeenCalled()
    expect(payInvoice).not.toHaveBeenCalled()
  })

  it('não age quando sub está em estado não recuperável (canceled)', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue(
      makeCustomerUpdatedEvent('pm_new')
    )
    ;(mockPrisma.store.findFirst as jest.Mock).mockResolvedValue(
      makeStore({ status: 'SUSPENDED', stripeSubscriptionId: 'sub_123' })
    )
    ;(retrieveSubscription as jest.Mock).mockResolvedValue({
      id: 'sub_123',
      status: 'canceled',
      latest_invoice: null,
    })

    await stripeWebhookController(makeReq() as Request, makeRes() as Response, makeNext())

    expect(setSubscriptionDefaultPaymentMethod).not.toHaveBeenCalled()
    expect(payInvoice).not.toHaveBeenCalled()
    expect(mockPrisma.store.update).not.toHaveBeenCalled()
  })
})

// ─── Unknown event ────────────────────────────────────────────────────────────

describe('Unknown Stripe event type', () => {
  it('responds with received:true and does not update database', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: {} },
    })

    const res = makeRes()
    const next = makeNext()

    await stripeWebhookController(makeReq() as Request, res as Response, next)

    expect(mockPrisma.store.update).not.toHaveBeenCalled()
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled()
    expect(res.jsonData).toEqual({ received: true })
    expect(next).not.toHaveBeenCalled()
  })
})
