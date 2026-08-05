/**
 * Unit tests — billing.service: troca de plano (upgrade pro-rata / downgrade agendado).
 */

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    store: { findUnique: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('../../../shared/asaas/asaas.service', () => ({
  getSubscription: jest.fn(),
  updateSubscription: jest.fn(),
  createTokenizedCharge: jest.fn(),
  // não usados aqui mas importados pelo módulo:
  createCustomer: jest.fn(),
  createPixAutoAuthorization: jest.fn(),
  createRecurrentCheckout: jest.fn(),
  getPixAutoAuthorization: jest.fn(),
}))

import {
  createRecurrentCheckout,
  createTokenizedCharge,
  getSubscription,
  updateSubscription,
} from '../../../shared/asaas/asaas.service'
import { prisma } from '../../../shared/prisma/prisma'
import { changePlan, createCheckoutSession, getChangePlanPreview } from '../billing.service'

const mockPrisma = prisma as unknown as {
  store: { findUnique: jest.Mock; update: jest.Mock }
  auditLog: { create: jest.Mock }
}

const activeCardStore = {
  id: 'store-1',
  status: 'ACTIVE',
  plan: 'PROFESSIONAL',
  billingMethod: 'CARD',
  asaasSubscriptionId: 'sub_1',
}

// nextDueDate exatamente 30 dias à frente → pro-rata = diferença cheia (149-99 = 50)
function subInDays(days: number) {
  const d = new Date(Date.now() + days * 86400000)
  return {
    id: 'sub_1',
    status: 'ACTIVE',
    value: 99,
    cycle: 'MONTHLY',
    nextDueDate: d.toISOString().slice(0, 10),
    customer: 'cus_1',
    creditCard: { creditCardToken: 'tok_1' },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.store.findUnique.mockResolvedValue(activeCardStore)
  mockPrisma.store.update.mockResolvedValue({})
  mockPrisma.auditLog.create.mockResolvedValue({})
  ;(getSubscription as jest.Mock).mockResolvedValue(subInDays(30))
  ;(updateSubscription as jest.Mock).mockResolvedValue({})
  ;(createTokenizedCharge as jest.Mock).mockResolvedValue({ id: 'pay_1', status: 'CONFIRMED', value: 50 })
})

describe('getChangePlanPreview', () => {
  it('UPGRADE: chargeNow = diferença cheia quando falta o ciclo inteiro (30 dias)', async () => {
    const p = await getChangePlanPreview('store-1', 'PREMIUM')
    expect(p.direction).toBe('UPGRADE')
    expect(p.chargeNow).toBe(50) // 149 - 99
    expect(p.nextCycleValue).toBe(149)
  })

  it('UPGRADE: pro-rata pela metade do ciclo (15 dias) → 25', async () => {
    ;(getSubscription as jest.Mock).mockResolvedValue(subInDays(15))
    const p = await getChangePlanPreview('store-1', 'PREMIUM')
    expect(p.chargeNow).toBe(25) // 50 * 15/30
  })

  it('DOWNGRADE: chargeNow = 0', async () => {
    mockPrisma.store.findUnique.mockResolvedValue({ ...activeCardStore, plan: 'PREMIUM' })
    const p = await getChangePlanPreview('store-1', 'PROFESSIONAL')
    expect(p.direction).toBe('DOWNGRADE')
    expect(p.chargeNow).toBe(0)
    expect(p.nextCycleValue).toBe(99)
  })

  it('422 quando já está no plano alvo', async () => {
    await expect(getChangePlanPreview('store-1', 'PROFESSIONAL')).rejects.toMatchObject({ status: 422 })
  })

  it('422 quando billingMethod não é CARD', async () => {
    mockPrisma.store.findUnique.mockResolvedValue({ ...activeCardStore, billingMethod: 'PIX_AUTO' })
    await expect(getChangePlanPreview('store-1', 'PREMIUM')).rejects.toMatchObject({ status: 422 })
  })
})

describe('changePlan — UPGRADE', () => {
  it('cobra pro-rata no cartão + updateSubscription pro novo valor + aplica plano/features na hora', async () => {
    const res = await changePlan('store-1', 'PREMIUM')
    expect(res).toEqual({ direction: 'UPGRADE', chargedNow: 50 })
    expect(createTokenizedCharge).toHaveBeenCalledWith(
      expect.objectContaining({ creditCardToken: 'tok_1', value: 50, customerId: 'cus_1' })
    )
    expect(updateSubscription).toHaveBeenCalledWith('sub_1', 149)
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: 'PREMIUM', pendingPlan: null }),
      })
    )
  })

  it('422 quando a assinatura não tem cartão tokenizado', async () => {
    ;(getSubscription as jest.Mock).mockResolvedValue({ ...subInDays(30), creditCard: undefined })
    await expect(changePlan('store-1', 'PREMIUM')).rejects.toMatchObject({ status: 422 })
    expect(createTokenizedCharge).not.toHaveBeenCalled()
  })
})

describe('changePlan — DOWNGRADE', () => {
  beforeEach(() => {
    mockPrisma.store.findUnique.mockResolvedValue({ ...activeCardStore, plan: 'PREMIUM' })
  })

  it('NÃO cobra, updateSubscription pro valor menor, grava pendingPlan (não mexe em plan/features agora)', async () => {
    const res = await changePlan('store-1', 'PROFESSIONAL')
    expect(res).toEqual({ direction: 'DOWNGRADE', chargedNow: 0 })
    expect(createTokenizedCharge).not.toHaveBeenCalled()
    expect(updateSubscription).toHaveBeenCalledWith('sub_1', 99)
    const updateArg = mockPrisma.store.update.mock.calls[0][0]
    expect(updateArg.data.pendingPlan).toBe('PROFESSIONAL')
    expect(updateArg.data.plan).toBeUndefined() // NÃO rebaixa agora
  })
})

describe('createCheckoutSession — pré-preenche customerData completo', () => {
  const storeForCheckout = {
    id: 'store-1',
    slug: 'loja-teste',
    name: 'Loja Teste',
    status: 'TRIAL',
    plan: 'PROFESSIONAL',
    phone: '48999990000',
    documentNumber: '24971563792',
    cep: '88010000',
    street: 'Rua Felipe Schmidt',
    number: '100',
    neighborhood: 'Centro',
    city: 'Florianópolis',
    state: 'SC',
    users: [{ email: 'admin@loja.com', name: 'Admin' }],
  }

  beforeEach(() => {
    ;(createRecurrentCheckout as jest.Mock).mockResolvedValue({ id: 'chk_1', link: 'https://asaas/x' })
  })

  it('passa customerData com nome/email/telefone/CPF + endereço completo quando a loja tem tudo', async () => {
    mockPrisma.store.findUnique.mockResolvedValue(storeForCheckout)
    await createCheckoutSession('store-1', 'https://loja-teste.menupanda.ai')

    const arg = (createRecurrentCheckout as jest.Mock).mock.calls[0][0]
    expect(arg.customerData).toEqual({
      name: 'Loja Teste',
      email: 'admin@loja.com',
      phone: '48999990000',
      cpfCnpj: '24971563792',
      postalCode: '88010000',
      address: 'Rua Felipe Schmidt',
      addressNumber: '100',
      province: 'Centro',
      city: 'Florianópolis',
    })
  })

  it('omite customerData quando falta endereço (loja antiga) — Asaas coleta na tela', async () => {
    mockPrisma.store.findUnique.mockResolvedValue({ ...storeForCheckout, cep: null, street: null })
    await createCheckoutSession('store-1', 'https://loja-teste.menupanda.ai')

    const arg = (createRecurrentCheckout as jest.Mock).mock.calls[0][0]
    expect(arg.customerData).toBeUndefined()
  })
})
