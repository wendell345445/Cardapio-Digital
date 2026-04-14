import { api } from '@/shared/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Period = 'day' | 'week' | 'month'
export type RankingPeriod = '7d' | '30d' | '90d' | 'all'

export interface SalesSummary {
  totalRevenue: number
  totalOrders: number
  averageTicket: number
  cancelledCount: number
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
  period?: RankingPeriod
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

// ─── Customer detail + update ────────────────────────────────────────────────

export interface CustomerAddress {
  id: string
  isPrimary: boolean
  zipCode: string
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  reference: string | null
}

export interface CustomerPhone {
  id: string
  isPrimary: boolean
  phone: string
  label: string | null
}

export interface CustomerDetail {
  whatsapp: string
  name: string | null
  totalOrders: number
  totalSpent: number
  averageTicket: number
  firstOrderAt: string | null
  lastOrderAt: string | null
  addresses: CustomerAddress[]
  phones: CustomerPhone[]
  hasProfile: boolean
}

export interface UpdateCustomerAddressInput {
  id?: string
  isPrimary?: boolean
  zipCode: string
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state: string
  reference?: string | null
}

export interface UpdateCustomerPhoneInput {
  id?: string
  phone: string
  label?: string | null
}

export interface UpdateCustomerInput {
  name: string
  primaryPhone: string
  addresses: UpdateCustomerAddressInput[]
  secondaryPhones: UpdateCustomerPhoneInput[]
}

export async function getCustomerDetail(whatsapp: string): Promise<CustomerDetail> {
  const { data } = await api.get(`/admin/analytics/clients/${encodeURIComponent(whatsapp)}`)
  return data.data
}

export async function updateCustomer(
  whatsapp: string,
  input: UpdateCustomerInput
): Promise<CustomerDetail> {
  const { data } = await api.patch(
    `/admin/analytics/clients/${encodeURIComponent(whatsapp)}`,
    input
  )
  return data.data
}
