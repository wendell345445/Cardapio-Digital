import { api } from '@/shared/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Period = 'day' | 'week' | 'month'

export interface SalesSummary {
  totalRevenue: number
  totalOrders: number
  averageTicket: number
  series: Array<{ label: string; revenue: number; orders: number }>
}

export interface TopProduct {
  productId: string
  productName: string
  quantity: number
  revenue: number
}

export interface PeakHour {
  hour: number
  orders: number
}

export interface ClientRankingItem {
  position: number
  clientId: string
  name?: string | null
  whatsapp: string
  totalOrders: number
  totalSpent: number
  lastOrderAt?: string | null
}

export interface ClientRankingResponse {
  clients: ClientRankingItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ClientRankingParams {
  period?: Period | 'all'
  page?: number
  limit?: number
  search?: string
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getSales(period: Period): Promise<SalesSummary> {
  const { data } = await api.get('/admin/analytics/sales', { params: { period } })
  return data.data
}

export async function getTopProducts(period: Period, limit?: number): Promise<TopProduct[]> {
  const { data } = await api.get('/admin/analytics/top-products', {
    params: { period, ...(limit ? { limit } : {}) },
  })
  return data.data
}

export async function getPeakHours(): Promise<PeakHour[]> {
  const { data } = await api.get('/admin/analytics/peak-hours')
  return data.data
}

export async function getClientRanking(
  params: ClientRankingParams
): Promise<ClientRankingResponse> {
  const { data } = await api.get('/admin/analytics/clients/ranking', { params })
  return data.data
}
