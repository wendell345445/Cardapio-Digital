/**
 * Unit tests — asaas.webhook.ts (migração Stripe → Asaas, item 4)
 *
 * Cobre:
 *  - token inválido → 401
 *  - PAYMENT_RECEIVED (cartão) → Store ACTIVE + grava asaasSubscriptionId + AuditLog
 *  - PAYMENT_OVERDUE → grace period (trialEndsAt futuro) + email + AuditLog
 *  - PAYMENT_REFUNDED → Store SUSPENDED
 *  - PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED → Store ACTIVE
 *  - PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED → Store SUSPENDED
 *  - loja não encontrada → received:true sem escrever no banco
 *  - evento desconhecido → received:true, no-op
 */

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    store: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('../../../shared/asaas/asaas.service', () => ({
  verifyWebhookToken: jest.fn(),
}))

jest.mock('../../../shared/email/email.service', () => ({
  sendPaymentFailedEmail: jest.fn().mockResolvedValue(undefined),
}))

import { NextFunction, Request, Response } from 'express'

import { verifyWebhookToken } from '../../../shared/asaas/asaas.service'
import { sendPaymentFailedEmail } from '../../../shared/email/email.service'
import { prisma } from '../../../shared/prisma/prisma'
import { asaasWebhookController } from '../asaas.webhook'

const mockPrisma = prisma as unknown as {
  store: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock }
  auditLog: { create: jest.Mock }
}

function makeReq(body: unknown, token = 'valid-token'): Partial<Request> {
  return { headers: { 'asaas-access-token': token }, body }
}

function makeRes(): Partial<Response> & { statusCode?: number; jsonData?: unknown } {
  const res: Partial<Response> & { statusCode?: number; jsonData?: unknown } = {}
  res.status = jest.fn((code: number) => {
    res.statusCode = code
    return res as Response
  }) as unknown as Response['status']
  res.json = jest.fn((data) => {
    res.jsonData = data
    return res as Response
  }) as unknown as Response['json']
  return res
}

const next: NextFunction = jest.fn()

const store = { id: 'store-1', status: 'TRIAL', plan: 'PROFESSIONAL', pendingPlan: null, users: [{ email: 'admin@loja.com' }] }

beforeEach(() => {
  jest.clearAllMocks()
  ;(verifyWebhookToken as jest.Mock).mockReturnValue(true)
  mockPrisma.store.findUnique.mockResolvedValue(store)
  mockPrisma.store.findFirst.mockResolvedValue(store)
  mockPrisma.store.update.mockResolvedValue({})
  mockPrisma.auditLog.create.mockResolvedValue({})
})

describe('asaas webhook — auth', () => {
  it('retorna 401 quando o token é inválido', async () => {
    ;(verifyWebhookToken as jest.Mock).mockReturnValue(false)
    const res = makeRes()
    await asaasWebhookController(makeReq({ event: 'PAYMENT_RECEIVED' }, 'bad') as Request, res as Response, next)
    expect(res.statusCode).toBe(401)
    expect(mockPrisma.store.update).not.toHaveBeenCalled()
  })
})

describe('asaas webhook — cartão (PAYMENT_*)', () => {
  it('PAYMENT_RECEIVED → ACTIVE + grava asaasSubscriptionId + billingMethod CARD', async () => {
    const res = makeRes()
    const body = {
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_1', externalReference: 'store-1', subscription: 'sub_1' },
    }
    await asaasWebhookController(makeReq(body) as Request, res as Response, next)

    // 1ª chamada grava subscription+billingMethod; 2ª ativa a loja
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'store-1' },
        data: expect.objectContaining({ asaasSubscriptionId: 'sub_1', billingMethod: 'CARD' }),
      })
    )
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE', trialEndsAt: null }) })
    )
    expect(res.jsonData).toEqual({ received: true })
  })

  it('correlaciona por checkoutSession quando externalReference/subscription não batem (1ª cobrança do Checkout)', async () => {
    // externalReference=null (Checkout hospedado não propaga), subscription ainda não
    // gravada (findFirst por asaasSubscriptionId → null), só bate por asaasCheckoutId.
    mockPrisma.store.findUnique.mockResolvedValue(null) // externalReference não bate
    mockPrisma.store.findFirst
      .mockResolvedValueOnce(null) // via subscription → não acha (ainda não gravada)
      .mockResolvedValueOnce(store) // via checkoutSession → acha
    const res = makeRes()
    const body = {
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: 'pay_co',
        customer: 'cus_novo_pagador',
        subscription: 'sub_co',
        checkoutSession: 'chk_abc',
        externalReference: null,
      },
    }
    await asaasWebhookController(makeReq(body) as Request, res as Response, next)
    // encontrou via findFirst e ativou
    expect(mockPrisma.store.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { asaasCheckoutId: 'chk_abc' } })
    )
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) })
    )
  })

  it('NÃO-regressão: loja SUSPENDED não reativa por PAYMENT_CONFIRMED atrasado', async () => {
    mockPrisma.store.findUnique.mockResolvedValue({ ...store, status: 'SUSPENDED' })
    mockPrisma.store.findFirst.mockResolvedValue({ ...store, status: 'SUSPENDED' })
    const res = makeRes()
    const body = { event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_old', externalReference: 'store-1', subscription: 'sub_x' } }
    await asaasWebhookController(makeReq(body) as Request, res as Response, next)
    // grava subscription/billingMethod é ok, mas NÃO deve setar status ACTIVE
    const setActive = mockPrisma.store.update.mock.calls.some(
      (c) => (c[0] as { data?: { status?: string } }).data?.status === 'ACTIVE'
    )
    expect(setActive).toBe(false)
    expect(res.jsonData).toEqual({ received: true })
  })

  it('downgrade agendado: PAYMENT_CONFIRMED de renovação aplica pendingPlan (rebaixa Premium→Prof)', async () => {
    const premiumWithPending = { ...store, plan: 'PREMIUM', pendingPlan: 'PROFESSIONAL' }
    mockPrisma.store.findUnique.mockResolvedValue(premiumWithPending)
    mockPrisma.store.findFirst.mockResolvedValue(premiumWithPending)
    const res = makeRes()
    const body = { event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_renov', externalReference: 'store-1', subscription: 'sub_1' } }
    await asaasWebhookController(makeReq(body) as Request, res as Response, next)
    // aplica o downgrade: plan=PROFESSIONAL e pendingPlan=null
    const appliedDowngrade = mockPrisma.store.update.mock.calls.some(
      (c) => (c[0] as { data?: { plan?: string; pendingPlan?: null } }).data?.plan === 'PROFESSIONAL'
    )
    expect(appliedDowngrade).toBe(true)
  })

  it('PAYMENT_OVERDUE → grace period (trialEndsAt no futuro) + email', async () => {
    const res = makeRes()
    const body = { event: 'PAYMENT_OVERDUE', payment: { id: 'pay_2', externalReference: 'store-1' } }
    await asaasWebhookController(makeReq(body) as Request, res as Response, next)

    const updateArg = mockPrisma.store.update.mock.calls[0][0]
    expect((updateArg.data.trialEndsAt as Date).getTime()).toBeGreaterThan(Date.now() - 1000)
    expect(sendPaymentFailedEmail).toHaveBeenCalled()
  })

  it('PAYMENT_REFUNDED → SUSPENDED', async () => {
    const res = makeRes()
    const body = { event: 'PAYMENT_REFUNDED', payment: { id: 'pay_3', externalReference: 'store-1' } }
    await asaasWebhookController(makeReq(body) as Request, res as Response, next)
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'SUSPENDED' } })
    )
  })
})

describe('asaas webhook — PIX Automático', () => {
  it('AUTHORIZATION_ACTIVATED → ACTIVE + billingMethod PIX_AUTO', async () => {
    const res = makeRes()
    const body = {
      event: 'PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED',
      authorization: { id: 'auth_1', status: 'ACTIVE' },
    }
    await asaasWebhookController(makeReq(body) as Request, res as Response, next)
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { billingMethod: 'PIX_AUTO' } })
    )
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) })
    )
  })

  it('AUTHORIZATION_CANCELLED → SUSPENDED', async () => {
    const res = makeRes()
    const body = {
      event: 'PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED',
      authorization: { id: 'auth_1' },
    }
    await asaasWebhookController(makeReq(body) as Request, res as Response, next)
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'SUSPENDED' } })
    )
  })
})

describe('asaas webhook — edge cases', () => {
  it('loja não encontrada → received:true sem update', async () => {
    mockPrisma.store.findUnique.mockResolvedValue(null)
    mockPrisma.store.findFirst.mockResolvedValue(null)
    const res = makeRes()
    const body = { event: 'PAYMENT_RECEIVED', payment: { id: 'pay_x', externalReference: 'nope' } }
    await asaasWebhookController(makeReq(body) as Request, res as Response, next)
    expect(mockPrisma.store.update).not.toHaveBeenCalled()
    expect(res.jsonData).toEqual({ received: true })
  })

  it('evento desconhecido → received:true, no-op', async () => {
    const res = makeRes()
    const body = { event: 'PAYMENT_CHECKOUT_VIEWED', payment: { id: 'pay_y', externalReference: 'store-1' } }
    await asaasWebhookController(makeReq(body) as Request, res as Response, next)
    expect(mockPrisma.store.update).not.toHaveBeenCalled()
    expect(res.jsonData).toEqual({ received: true })
  })
})
