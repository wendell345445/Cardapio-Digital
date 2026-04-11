import axios from 'axios'

// ─── TASK-122/124: slug vem do hostname (subdomain routing) ──────────────────

const menuApi = axios.create({ baseURL: '/api/v1' })

export interface OrderAddress {
  street: string; number: string; complement?: string; neighborhood: string; city: string
}

export interface OrderItem {
  productId: string; variationId?: string; quantity: number; notes?: string; additionalIds: string[]
}

export interface CreateOrderDto {
  clientWhatsapp: string; clientName?: string
  type: 'DELIVERY' | 'PICKUP' | 'TABLE'
  paymentMethod: 'PIX' | 'CASH_ON_DELIVERY'
  notes?: string; couponCode?: string
  address?: OrderAddress
  items: OrderItem[]
}

export interface OrderResult {
  orderId: string; orderNumber: number; token: string; total: number; status: string
  pixKey?: string; pixKeyType?: string
}

export async function submitOrder(dto: CreateOrderDto): Promise<OrderResult> {
  const { data } = await menuApi.post('/menu/orders', dto)
  return data.data
}
