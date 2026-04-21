import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── TASK-095 / A-077..A-081: contrato de Controle de Caixa ──────────────────
// Garante que o service bate EXATAMENTE com o backend (enum BLEED/SUPPLY,
// campos expectedCash/totalSupply/totalBleed e shape { cashFlow, summary }).

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

vi.mock('@/shared/lib/api', () => ({
  api: apiMock,
}))

import {
  addAdjustment,
  closeCashFlow,
  getCashFlowSummary,
  getCurrentCashFlow,
  listCashFlows,
  openCashFlow,
  updateInitialAmount,
} from '../cashflow.service'

beforeEach(() => {
  apiMock.get.mockReset()
  apiMock.post.mockReset()
  apiMock.patch.mockReset()
})

describe('cashflow.service contrato com backend', () => {
  it('listCashFlows → GET /admin/cashflows e retorna array', async () => {
    apiMock.get.mockResolvedValue({ data: { data: [{ id: 'cf-1' }] } })
    const result = await listCashFlows()
    expect(apiMock.get).toHaveBeenCalledWith('/admin/cashflows')
    expect(result).toEqual([{ id: 'cf-1' }])
  })

  it('getCurrentCashFlow → GET /admin/cashflows/current', async () => {
    apiMock.get.mockResolvedValue({ data: { data: { id: 'cf-1', status: 'OPEN' } } })
    const result = await getCurrentCashFlow()
    expect(apiMock.get).toHaveBeenCalledWith('/admin/cashflows/current')
    expect(result).toMatchObject({ id: 'cf-1', status: 'OPEN' })
  })

  it('getCurrentCashFlow → null em 404', async () => {
    apiMock.get.mockRejectedValue({ response: { status: 404 } })
    const result = await getCurrentCashFlow()
    expect(result).toBeNull()
  })

  it('openCashFlow → POST /admin/cashflows com initialAmount', async () => {
    apiMock.post.mockResolvedValue({ data: { data: { id: 'cf-1' } } })
    await openCashFlow(50)
    expect(apiMock.post).toHaveBeenCalledWith('/admin/cashflows', { initialAmount: 50 })
  })

  it('getCashFlowSummary retorna { cashFlow, summary } com campos backend (expectedCash, totalSupply, totalBleed)', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          cashFlow: { id: 'cf-1', status: 'OPEN', adjustments: [] },
          summary: {
            totalOrders: 120,
            totalCash: 80,
            totalPix: 40,
            totalSupply: 50,
            totalBleed: 20,
            expectedCash: 210,
            orderCount: 2,
          },
        },
      },
    })
    const res = await getCashFlowSummary('cf-1')
    expect(apiMock.get).toHaveBeenCalledWith('/admin/cashflows/cf-1/summary')
    expect(res.summary.expectedCash).toBe(210)
    expect(res.summary.totalSupply).toBe(50)
    expect(res.summary.totalBleed).toBe(20)
  })

  it('updateInitialAmount → PATCH /:id/initial-amount', async () => {
    apiMock.patch.mockResolvedValue({ data: { data: { id: 'cf-1' } } })
    await updateInitialAmount('cf-1', 150)
    expect(apiMock.patch).toHaveBeenCalledWith('/admin/cashflows/cf-1/initial-amount', {
      initialAmount: 150,
    })
  })

  it('addAdjustment envia type BLEED/SUPPLY (nunca SANGRIA/SUPRIMENTO)', async () => {
    apiMock.post.mockResolvedValue({ data: { data: {} } })
    await addAdjustment('cf-1', 'BLEED', 30, 'Sangria parcial')
    expect(apiMock.post).toHaveBeenCalledWith('/admin/cashflows/cf-1/adjustments', {
      type: 'BLEED',
      amount: 30,
      notes: 'Sangria parcial',
    })

    apiMock.post.mockClear()
    await addAdjustment('cf-1', 'SUPPLY', 50)
    expect(apiMock.post).toHaveBeenCalledWith('/admin/cashflows/cf-1/adjustments', {
      type: 'SUPPLY',
      amount: 50,
      notes: undefined,
    })
  })

  it('closeCashFlow → POST /:id/close com countedAmount e justification', async () => {
    apiMock.post.mockResolvedValue({ data: { data: {} } })
    await closeCashFlow('cf-1', 200, 'sobra de troco')
    expect(apiMock.post).toHaveBeenCalledWith('/admin/cashflows/cf-1/close', {
      countedAmount: 200,
      justification: 'sobra de troco',
    })
  })
})
