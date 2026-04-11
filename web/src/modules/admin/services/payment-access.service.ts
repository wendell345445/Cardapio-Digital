import { api } from '@/shared/lib/api'

// ─── TASK-054: Blacklist e Whitelist de Clientes ──────────────────────────────

export interface StoreClient {
  id: string
  name: string
  whatsapp?: string
  email?: string
  accessType: 'BLACKLIST' | 'WHITELIST' | null
  accessId: string | null
}

export interface AddPaymentAccessDto {
  clientId: string
  type: 'BLACKLIST' | 'WHITELIST'
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchStoreClients(): Promise<StoreClient[]> {
  const { data } = await api.get('/admin/store/clients')
  return data.data
}

export async function addPaymentAccess(dto: AddPaymentAccessDto): Promise<unknown> {
  const { data } = await api.post('/admin/store/payment-access', dto)
  return data.data
}

export async function removePaymentAccess(clientId: string): Promise<void> {
  await api.delete(`/admin/store/payment-access/${clientId}`)
}
