import axios from 'axios'

// ─── TASK-122/124: slug vem do hostname (subdomain routing) ──────────────────

// Dev: relativo (proxy do Vite). Prod: VITE_API_URL absoluto.
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1'

const menuApi = axios.create({ baseURL })

export interface OrderAddress {
  zipCode?: string
  street: string; number: string; complement?: string; neighborhood: string; city: string
}

export interface OrderItem {
  productId: string; variationId?: string; quantity: number; notes?: string; additionalIds: string[]
}

export type PaymentMethod =
  | 'PIX'
  | 'CREDIT_CARD'
  | 'CASH_ON_DELIVERY'
  | 'CREDIT_ON_DELIVERY'
  | 'DEBIT_ON_DELIVERY'
  | 'PIX_ON_DELIVERY'

export interface CreateOrderDto {
  clientWhatsapp: string; clientName?: string
  type: 'DELIVERY' | 'PICKUP' | 'TABLE'
  paymentMethod: PaymentMethod
  notes?: string; couponCode?: string
  address?: OrderAddress
  /** C-002/C-022: número da mesa quando cliente entrou via QR code */
  tableNumber?: number
  scheduledFor?: string
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

export interface DeliveryFeeResult {
  fee: number
  mode: 'NEIGHBORHOOD' | 'DISTANCE' | null
}

export async function calculateDeliveryFee(neighborhood: string): Promise<DeliveryFeeResult> {
  const { data } = await menuApi.post('/menu/delivery/calculate', { neighborhood })
  return data.data
}
