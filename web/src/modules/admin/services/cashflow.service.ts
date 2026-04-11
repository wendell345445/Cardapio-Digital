import { api } from '@/shared/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CashFlowStatus = 'OPEN' | 'CLOSED'
export type AdjustmentType = 'SANGRIA' | 'SUPRIMENTO'

export interface CashFlowAdjustment {
  id: string
  type: AdjustmentType
  amount: number
  notes?: string | null
  createdAt: string
}

export interface CashFlow {
  id: string
  status: CashFlowStatus
  initialAmount: number
  openedAt: string
  closedAt?: string | null
  countedAmount?: number | null
  justification?: string | null
  adjustments: CashFlowAdjustment[]
}

export interface CashFlowSummary {
  cashFlowId: string
  status: CashFlowStatus
  initialAmount: number
  openedAt: string
  closedAt?: string | null
  totalOrders: number
  totalPix: number
  totalCash: number
  totalSangrias: number
  totalSuprimentos: number
  expectedBalance: number
  countedAmount?: number | null
  difference?: number | null
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function listCashFlows(): Promise<CashFlow[]> {
  const { data } = await api.get('/admin/cashflows')
  return data.data
}

export async function getCurrentCashFlow(): Promise<CashFlow | null> {
  try {
    const { data } = await api.get('/admin/cashflows/current')
    return data.data
  } catch (err: unknown) {
    // 404 means no open cashflow
    if (
      typeof err === 'object' &&
      err !== null &&
      'response' in err &&
      (err as { response?: { status?: number } }).response?.status === 404
    ) {
      return null
    }
    throw err
  }
}

export async function openCashFlow(initialAmount: number): Promise<CashFlow> {
  const { data } = await api.post('/admin/cashflows', { initialAmount })
  return data.data
}

export async function getCashFlowSummary(id: string): Promise<CashFlowSummary> {
  const { data } = await api.get(`/admin/cashflows/${id}/summary`)
  return data.data
}

export async function updateInitialAmount(
  id: string,
  initialAmount: number
): Promise<CashFlow> {
  const { data } = await api.patch(`/admin/cashflows/${id}/initial-amount`, { initialAmount })
  return data.data
}

export async function addAdjustment(
  id: string,
  type: AdjustmentType,
  amount: number,
  notes?: string
): Promise<CashFlow> {
  const { data } = await api.post(`/admin/cashflows/${id}/adjustments`, {
    type,
    amount,
    notes,
  })
  return data.data
}

export async function closeCashFlow(
  id: string,
  countedAmount: number,
  justification?: string
): Promise<CashFlow> {
  const { data } = await api.post(`/admin/cashflows/${id}/close`, {
    countedAmount,
    justification,
  })
  return data.data
}
