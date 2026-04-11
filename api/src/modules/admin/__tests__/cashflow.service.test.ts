// ─── TASK-095: Controle de Caixa — Unit Tests ────────────────────────────────
// Cobre: openCashFlow, updateInitialAmount, addAdjustment, getCashFlowSummary,
//        closeCashFlow, linkOrderToCashFlow

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    cashFlow: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cashFlowAdjustment: {
      create: jest.fn(),
    },
    cashFlowItem: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: {
    cashFlowUpdated: jest.fn(),
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import { emit } from '../../../shared/socket/socket'
import {
  openCashFlow,
  updateInitialAmount,
  addAdjustment,
  getCashFlowSummary,
  closeCashFlow,
  linkOrderToCashFlow,
  listCashFlows,
  getCurrentCashFlow,
} from '../cashflow.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockEmit = emit as jest.Mocked<typeof emit>

const STORE_ID = 'store-1'
const USER_ID = 'admin-1'
const CF_ID = 'cf-1'
const ORDER_ID = 'order-1'
const IP = '127.0.0.1'

const mockOpenCashFlow = {
  id: CF_ID,
  storeId: STORE_ID,
  status: 'OPEN' as const,
  initialAmount: 100,
  openedAt: new Date(),
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const makeSummaryData = (overrides: {
  initialAmount?: number
  adjustments?: { type: string; amount: number }[]
  items?: { order: { paymentMethod: string; total: number }; amount: number }[]
}) => ({
  ...mockOpenCashFlow,
  initialAmount: overrides.initialAmount ?? 100,
  adjustments: overrides.adjustments ?? [],
  items: overrides.items ?? [],
})

beforeEach(() => jest.clearAllMocks())

// ─── listCashFlows ────────────────────────────────────────────────────────────

describe('listCashFlows', () => {
  it('retorna histórico de caixas da loja ordenados por openedAt desc', async () => {
    ;(mockPrisma.cashFlow.findMany as jest.Mock).mockResolvedValue([mockOpenCashFlow])

    const result = await listCashFlows(STORE_ID)

    expect(mockPrisma.cashFlow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: STORE_ID },
        orderBy: { openedAt: 'desc' },
      })
    )
    expect(result).toHaveLength(1)
  })
})

// ─── getCurrentCashFlow ───────────────────────────────────────────────────────

describe('getCurrentCashFlow', () => {
  it('retorna o caixa aberto atual', async () => {
    ;(mockPrisma.cashFlow.findFirst as jest.Mock).mockResolvedValue(mockOpenCashFlow)

    const result = await getCurrentCashFlow(STORE_ID)

    expect(mockPrisma.cashFlow.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: STORE_ID, status: 'OPEN' } })
    )
    expect(result?.id).toBe(CF_ID)
  })

  it('retorna null quando não há caixa aberto', async () => {
    ;(mockPrisma.cashFlow.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await getCurrentCashFlow(STORE_ID)

    expect(result).toBeNull()
  })
})

// ─── openCashFlow ─────────────────────────────────────────────────────────────

describe('openCashFlow', () => {
  it('abre caixa com troco inicial e registra AuditLog', async () => {
    ;(mockPrisma.cashFlow.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.cashFlow.create as jest.Mock).mockResolvedValue(mockOpenCashFlow)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await openCashFlow(STORE_ID, { initialAmount: 100 }, USER_ID, IP)

    expect(result.id).toBe(CF_ID)
    expect(mockPrisma.cashFlow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ storeId: STORE_ID, initialAmount: 100, status: 'OPEN' }),
      })
    )
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'cashflow.open', entity: 'CashFlow' }),
      })
    )
    expect(mockEmit.cashFlowUpdated).toHaveBeenCalledWith(STORE_ID, expect.objectContaining({ type: 'opened' }))
  })

  it('lança 422 quando já existe um caixa aberto', async () => {
    ;(mockPrisma.cashFlow.findFirst as jest.Mock).mockResolvedValue(mockOpenCashFlow)

    await expect(
      openCashFlow(STORE_ID, { initialAmount: 0 }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.cashFlow.create).not.toHaveBeenCalled()
  })
})

// ─── updateInitialAmount ──────────────────────────────────────────────────────

describe('updateInitialAmount', () => {
  it('ajusta troco inicial e registra AuditLog', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(mockOpenCashFlow)
    ;(mockPrisma.cashFlow.update as jest.Mock).mockResolvedValue({ ...mockOpenCashFlow, initialAmount: 150 })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updateInitialAmount(STORE_ID, CF_ID, { initialAmount: 150 }, USER_ID)

    expect(result.initialAmount).toBe(150)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'cashflow.update_initial_amount' }),
      })
    )
  })

  it('lança 404 quando caixa não existe', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      updateInitialAmount(STORE_ID, CF_ID, { initialAmount: 150 }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança 422 quando caixa já está fechado', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue({
      ...mockOpenCashFlow,
      status: 'CLOSED',
    })

    await expect(
      updateInitialAmount(STORE_ID, CF_ID, { initialAmount: 150 }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })
  })

  it('lança 404 quando caixa pertence a outra loja (isolamento multi-tenant)', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue({
      ...mockOpenCashFlow,
      storeId: 'outra-loja',
    })

    await expect(
      updateInitialAmount(STORE_ID, CF_ID, { initialAmount: 150 }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── addAdjustment ────────────────────────────────────────────────────────────

describe('addAdjustment', () => {
  const supplyInput = { type: 'SUPPLY' as const, amount: 50, notes: 'Reforço de troco' }
  const bleedInput = { type: 'BLEED' as const, amount: 30, notes: 'Sangria parcial' }

  const mockAdjustment = {
    id: 'adj-1',
    cashFlowId: CF_ID,
    type: 'SUPPLY' as const,
    amount: 50,
    notes: 'Reforço de troco',
    userId: USER_ID,
    createdAt: new Date(),
  }

  it('registra suprimento (SUPPLY) e AuditLog', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(mockOpenCashFlow)
    ;(mockPrisma.cashFlowAdjustment.create as jest.Mock).mockResolvedValue(mockAdjustment)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await addAdjustment(STORE_ID, CF_ID, supplyInput, USER_ID, IP)

    expect(result.type).toBe('SUPPLY')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'cashflow.supply' }),
      })
    )
    expect(mockEmit.cashFlowUpdated).toHaveBeenCalledWith(
      STORE_ID,
      expect.objectContaining({ type: 'adjustment' })
    )
  })

  it('registra sangria (BLEED) e AuditLog com action cashflow.bleed', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(mockOpenCashFlow)
    ;(mockPrisma.cashFlowAdjustment.create as jest.Mock).mockResolvedValue({
      ...mockAdjustment,
      type: 'BLEED',
      amount: 30,
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await addAdjustment(STORE_ID, CF_ID, bleedInput, USER_ID)

    expect(result.type).toBe('BLEED')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'cashflow.bleed' }),
      })
    )
  })

  it('lança 404 quando caixa não existe', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      addAdjustment(STORE_ID, CF_ID, supplyInput, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança 422 quando caixa está fechado', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue({
      ...mockOpenCashFlow,
      status: 'CLOSED',
    })

    await expect(
      addAdjustment(STORE_ID, CF_ID, supplyInput, USER_ID)
    ).rejects.toMatchObject({ status: 422 })
  })
})

// ─── getCashFlowSummary — cálculo de saldo esperado ──────────────────────────

describe('getCashFlowSummary', () => {
  it('calcula saldo esperado: troco + dinheiro + suprimentos − sangrias', async () => {
    // initialAmount=100, cash=80, supply=50, bleed=30
    // expectedCash = 100 + 80 + 50 - 30 = 200
    const cf = makeSummaryData({
      initialAmount: 100,
      adjustments: [
        { type: 'SUPPLY', amount: 50 },
        { type: 'BLEED', amount: 30 },
      ],
      items: [
        { order: { paymentMethod: 'CASH_ON_DELIVERY', total: 80 }, amount: 80 },
        { order: { paymentMethod: 'PIX', total: 40 }, amount: 40 },
      ],
    })
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(cf)

    const { summary } = await getCashFlowSummary(STORE_ID, CF_ID)

    expect(summary.totalCash).toBe(80)
    expect(summary.totalPix).toBe(40)
    expect(summary.totalSupply).toBe(50)
    expect(summary.totalBleed).toBe(30)
    expect(summary.expectedCash).toBe(200) // 100 + 80 + 50 - 30
    expect(summary.totalOrders).toBe(120) // 80 + 40
    expect(summary.orderCount).toBe(2)
  })

  it('saldo esperado sem ajustes = troco + dinheiro', async () => {
    const cf = makeSummaryData({
      initialAmount: 50,
      items: [{ order: { paymentMethod: 'CASH_ON_DELIVERY', total: 60 }, amount: 60 }],
    })
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(cf)

    const { summary } = await getCashFlowSummary(STORE_ID, CF_ID)

    expect(summary.expectedCash).toBe(110) // 50 + 60
  })

  it('saldo esperado sem pedidos = apenas troco inicial', async () => {
    const cf = makeSummaryData({ initialAmount: 200 })
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(cf)

    const { summary } = await getCashFlowSummary(STORE_ID, CF_ID)

    expect(summary.expectedCash).toBe(200)
    expect(summary.totalOrders).toBe(0)
  })

  it('lança 404 quando caixa não existe', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(getCashFlowSummary(STORE_ID, CF_ID)).rejects.toMatchObject({ status: 404 })
  })

  it('lança 404 quando caixa pertence a outra loja', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue({
      ...makeSummaryData({}),
      storeId: 'outra-loja',
    })

    await expect(getCashFlowSummary(STORE_ID, CF_ID)).rejects.toMatchObject({ status: 404 })
  })
})

// ─── closeCashFlow ────────────────────────────────────────────────────────────

describe('closeCashFlow', () => {
  const cfWithItems = makeSummaryData({
    initialAmount: 100,
    items: [{ order: { paymentMethod: 'CASH_ON_DELIVERY', total: 80 }, amount: 80 }],
  })

  it('fecha caixa sem diferença sem exigir justificativa', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock)
      .mockResolvedValueOnce(mockOpenCashFlow) // requireOpenCashFlow
      .mockResolvedValueOnce(cfWithItems)       // getCashFlowSummary
    ;(mockPrisma.cashFlow.update as jest.Mock).mockResolvedValue({
      ...mockOpenCashFlow,
      status: 'CLOSED',
      adjustments: [],
      items: [],
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    // expectedCash = 100 + 80 = 180; countedAmount = 180 → diferença = 0
    const result = await closeCashFlow(
      STORE_ID,
      CF_ID,
      { countedAmount: 180 },
      USER_ID,
      IP
    )

    expect(result.cashFlow.status).toBe('CLOSED')
    expect(result.summary.difference).toBe(0)
    expect(mockEmit.cashFlowUpdated).toHaveBeenCalledWith(STORE_ID, expect.objectContaining({ type: 'closed' }))
  })

  it('lança 422 quando há diferença de caixa sem justificativa', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock)
      .mockResolvedValueOnce(mockOpenCashFlow)
      .mockResolvedValueOnce(cfWithItems)

    // expectedCash = 180; countedAmount = 150 → diferença = -30 (sem justificativa)
    await expect(
      closeCashFlow(STORE_ID, CF_ID, { countedAmount: 150 }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.cashFlow.update).not.toHaveBeenCalled()
  })

  it('fecha caixa com diferença quando justificativa é informada', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock)
      .mockResolvedValueOnce(mockOpenCashFlow)
      .mockResolvedValueOnce(cfWithItems)
    ;(mockPrisma.cashFlow.update as jest.Mock).mockResolvedValue({
      ...mockOpenCashFlow,
      status: 'CLOSED',
      adjustments: [],
      items: [],
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await closeCashFlow(
      STORE_ID,
      CF_ID,
      { countedAmount: 150, justification: 'Cliente pagou errado' },
      USER_ID
    )

    expect(result.cashFlow.status).toBe('CLOSED')
    expect(result.summary.difference).toBe(-30) // 150 - 180
  })

  it('registra diferença positiva (sobra) no AuditLog', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock)
      .mockResolvedValueOnce(mockOpenCashFlow)
      .mockResolvedValueOnce(cfWithItems)
    ;(mockPrisma.cashFlow.update as jest.Mock).mockResolvedValue({
      ...mockOpenCashFlow,
      status: 'CLOSED',
      adjustments: [],
      items: [],
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    // sobra: 200 - 180 = +20
    const result = await closeCashFlow(
      STORE_ID,
      CF_ID,
      { countedAmount: 200, justification: 'Sobra de troco' },
      USER_ID
    )

    expect(result.summary.difference).toBe(20)
  })

  it('lança 422 quando caixa já está fechado', async () => {
    ;(mockPrisma.cashFlow.findUnique as jest.Mock).mockResolvedValue({
      ...mockOpenCashFlow,
      status: 'CLOSED',
    })

    await expect(
      closeCashFlow(STORE_ID, CF_ID, { countedAmount: 100 }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })
  })
})

// ─── linkOrderToCashFlow ──────────────────────────────────────────────────────

describe('linkOrderToCashFlow', () => {
  it('vincula pedido confirmado ao caixa aberto', async () => {
    ;(mockPrisma.cashFlow.findFirst as jest.Mock).mockResolvedValue(mockOpenCashFlow)
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      total: 60,
      paymentMethod: 'PIX',
    })
    ;(mockPrisma.cashFlowItem.findUnique as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.cashFlowItem.create as jest.Mock).mockResolvedValue({})

    await linkOrderToCashFlow(STORE_ID, ORDER_ID)

    expect(mockPrisma.cashFlowItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cashFlowId: CF_ID,
          orderId: ORDER_ID,
          amount: 60,
        }),
      })
    )
  })

  it('não vincula quando não há caixa aberto', async () => {
    ;(mockPrisma.cashFlow.findFirst as jest.Mock).mockResolvedValue(null)

    await linkOrderToCashFlow(STORE_ID, ORDER_ID)

    expect(mockPrisma.cashFlowItem.create).not.toHaveBeenCalled()
  })

  it('não duplica item quando pedido já está vinculado', async () => {
    ;(mockPrisma.cashFlow.findFirst as jest.Mock).mockResolvedValue(mockOpenCashFlow)
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ total: 60, paymentMethod: 'PIX' })
    ;(mockPrisma.cashFlowItem.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-item' })

    await linkOrderToCashFlow(STORE_ID, ORDER_ID)

    expect(mockPrisma.cashFlowItem.create).not.toHaveBeenCalled()
  })

  it('não vincula quando pedido não existe', async () => {
    ;(mockPrisma.cashFlow.findFirst as jest.Mock).mockResolvedValue(mockOpenCashFlow)
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    await linkOrderToCashFlow(STORE_ID, ORDER_ID)

    expect(mockPrisma.cashFlowItem.create).not.toHaveBeenCalled()
  })
})
