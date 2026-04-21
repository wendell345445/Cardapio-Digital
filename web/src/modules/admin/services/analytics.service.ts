import { api } from '@/shared/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Period = 'day' | 'week' | 'month' | 'range'
export type RankingPeriod = '7d' | '30d' | '90d' | 'all'

export interface DateRange {
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
}

function periodParams(period: Period, range?: DateRange): Record<string, string> {
  if (period === 'range' && range) {
    return { period: 'range', from: range.from, to: range.to }
  }
  return { period }
}

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

export interface PaymentBreakdownItem {
  method: string
  count: number
  revenue: number
  percentage: number
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

export async function getSales(period: Period, range?: DateRange): Promise<SalesSummary> {
  const { data } = await api.get('/admin/analytics/sales', {
    params: periodParams(period, range),
  })
  return data.data
}

export async function getTopProducts(
  period: Period,
  limit?: number,
  range?: DateRange
): Promise<TopProduct[]> {
  const { data } = await api.get('/admin/analytics/top-products', {
    params: { ...periodParams(period, range), ...(limit ? { limit } : {}) },
  })
  return data.data
}

export async function getPeakHours(period: Period = 'month', range?: DateRange): Promise<PeakHour[]> {
  const { data } = await api.get('/admin/analytics/peak-hours', {
    params: periodParams(period, range),
  })
  return data.data
}

export async function getPaymentBreakdown(
  period: Period,
  range?: DateRange
): Promise<PaymentBreakdownItem[]> {
  const { data } = await api.get('/admin/analytics/payment-breakdown', {
    params: periodParams(period, range),
  })
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

// ─── Customer order history ─────────────────────────────────────────────────

export interface CustomerOrderProduct {
  productName: string
  variationName: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface CustomerOrderItem {
  id: string
  number: number
  type: string
  status: string
  paymentMethod: string
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  items: CustomerOrderProduct[]
  createdAt: string
}

export interface CustomerOrdersResponse {
  orders: CustomerOrderItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function getCustomerOrders(
  whatsapp: string,
  page = 1,
  limit = 10
): Promise<CustomerOrdersResponse> {
  const { data } = await api.get(
    `/admin/analytics/clients/${encodeURIComponent(whatsapp)}/orders`,
    { params: { page, limit } }
  )
  return data.data
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
