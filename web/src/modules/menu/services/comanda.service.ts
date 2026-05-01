// ─── Comanda pública do cliente — Service ────────────────────────────────────

import { createPublicApi } from '@/shared/lib/publicApi'


const api = createPublicApi()

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ComandaItemAdditional {
  id: string
  name: string
  price: number
}

export interface ComandaItem {
  id: string
  productName: string
  variationName: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  notes: string | null
  status: 'PENDING' | 'PREPARING' | 'DELIVERED'
  additionals: ComandaItemAdditional[]
}

export interface ComandaOrder {
  id: string
  number: number
  createdAt: string
  deviceName: string | null
}

export interface CustomerComanda {
  table: { id: string; number: number }
  sessionId: string
  orders: ComandaOrder[]
  items: ComandaItem[]
  subtotal: number
  total: number
  storeId: string
}

// ─── API calls ───────────────────────────────────────────────────────────────

export async function fetchCustomerComanda(token: string): Promise<CustomerComanda> {
  const { data } = await api.get('/menu/comanda', { params: { token } })
  return data.data
}

export async function requestCheck(token: string): Promise<void> {
  await api.post('/menu/comanda/check', { token })
}
