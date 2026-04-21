// ─── A-056: Comanda pública do cliente — Service ─────────────────────────────

import { createPublicApi } from '@/shared/lib/publicApi'

const api = createPublicApi({ withCredentials: true })

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
}

export interface CustomerComanda {
  table: { id: string; number: number }
  orders: ComandaOrder[]
  items: ComandaItem[]
  subtotal: number
  total: number
  storeId: string
}

// ─── API calls ───────────────────────────────────────────────────────────────

export async function fetchCustomerComanda(tableNumber: number): Promise<CustomerComanda> {
  const { data } = await api.get('/menu/comanda', { params: { tableNumber } })
  return data.data
}

export async function requestCheck(tableNumber: number): Promise<void> {
  await api.post('/menu/comanda/check', { tableNumber })
}
