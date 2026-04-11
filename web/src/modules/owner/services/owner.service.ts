import { api } from '@/shared/lib/api'

export type StoreStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
export type StorePlan = 'PROFESSIONAL' | 'PREMIUM'

export interface StoreListItem {
  id: string
  name: string
  slug: string
  plan: StorePlan
  status: StoreStatus
  createdAt: string
  planMrr: number
}

export interface StoreListResult {
  stores: StoreListItem[]
  mrr: number
}

export type WhatsAppMode = 'WHATSAPP' | 'WHATSAPP_AI'

export interface StoreDetail {
  id: string
  name: string
  slug: string
  description: string | null
  plan: StorePlan
  status: StoreStatus
  phone: string
  whatsappMode: WhatsAppMode
  features: Record<string, boolean>
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  createdAt: string
  updatedAt: string
  users: { id: string; email: string | null; name: string | null }[]
  businessHours: {
    id: string
    dayOfWeek: number
    openTime: string | null
    closeTime: string | null
    isClosed: boolean
  }[]
}

export interface AuditLog {
  id: string
  action: string
  entity: string
  entityId: string | null
  data: unknown
  ip: string | null
  createdAt: string
  // `user` é null quando a ação foi disparada por sistema (cron de suspensão,
  // webhooks Stripe). v2.5.6+ tornou `AuditLog.userId` nullable no schema.
  user: { id: string; email: string | null; name: string | null; role: string } | null
}

export interface AuditLogsResult {
  logs: AuditLog[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

export interface CreateStoreDto {
  name: string
  slug: string
  plan: StorePlan
  adminEmail: string
  whatsapp: string
  adminName?: string
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchStores(status?: StoreStatus): Promise<StoreListResult> {
  const params = status ? { status } : {}
  const { data } = await api.get('/owner/stores', { params })
  return data.data
}

export async function fetchStore(id: string): Promise<StoreDetail> {
  const { data } = await api.get(`/owner/stores/${id}`)
  return data.data
}

export async function createStore(dto: CreateStoreDto): Promise<StoreDetail> {
  const { data } = await api.post('/owner/stores', dto)
  return data.data
}

export async function updateStore(
  id: string,
  dto: { name?: string; description?: string; status?: StoreStatus }
): Promise<StoreDetail> {
  const { data } = await api.patch(`/owner/stores/${id}`, dto)
  return data.data
}

export async function cancelStore(id: string): Promise<StoreDetail> {
  const { data } = await api.delete(`/owner/stores/${id}`)
  return data.data
}

export async function updateStorePlan(id: string, plan: StorePlan): Promise<StoreDetail> {
  const { data } = await api.patch(`/owner/stores/${id}/plan`, { plan })
  return data.data
}

// ─── OWNER TOOL ───────────────────────────────────────────────────────────────
// POST /owner/stores/:id/dev/end-trial — encerra o trial no Stripe + dispara
// sweep imediato + envia email "trial-suspended". Disponível em todos os
// ambientes; a rota exige JWT com role OWNER.
export async function endTrialNow(id: string): Promise<{ ok: boolean; message: string }> {
  const { data } = await api.post(`/owner/stores/${id}/dev/end-trial`)
  return data.data
}

export async function fetchAuditLogs(
  storeId: string,
  params: { page?: number; limit?: number; action?: string; userId?: string; from?: string; to?: string }
): Promise<AuditLogsResult> {
  const { data } = await api.get(`/owner/stores/${storeId}/audit-logs`, { params })
  return data.data
}
