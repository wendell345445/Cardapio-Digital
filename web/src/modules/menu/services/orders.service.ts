import { createPublicApi } from '../../../shared/lib/publicApi'

const menuApi = createPublicApi()

export interface OrderAddress {
  zipCode?: string
  street: string; number: string; complement?: string; neighborhood: string; city: string; state?: string
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
  | 'PENDING'

export interface CreateOrderDto {
  clientName: string
  /** TASK-130: id por navegador (UUID em localStorage) — usado em /meus-pedidos */
  customerSessionId?: string
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

export interface SessionOrderSummary {
  id: string
  number: number
  status: string
  type: 'DELIVERY' | 'PICKUP' | 'TABLE'
  total: number
  paymentMethod: string
  notifyOnStatusChange: boolean
  createdAt: string
  token: string
}

export async function listOrdersBySession(sessionId: string): Promise<SessionOrderSummary[]> {
  const { data } = await menuApi.get(`/menu/orders/by-session/${encodeURIComponent(sessionId)}`)
  return data.data
}

export interface GeocodeAddressPayload {
  cep?: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
}

export interface GeocodeResult {
  latitude: number
  longitude: number
  displayName?: string
}

export async function geocodeAddress(payload: GeocodeAddressPayload): Promise<GeocodeResult> {
  const { data } = await menuApi.post('/menu/delivery/geocode', payload)
  return data.data
}

export interface DeliveryFeeResult {
  fee: number
  distance?: number
}

export async function calculateDeliveryFee(
  latitude: number,
  longitude: number
): Promise<DeliveryFeeResult> {
  const { data } = await menuApi.post('/menu/delivery/calculate', { latitude, longitude })
  return data.data
}

export interface ValidateCouponResult {
  discount: number
  coupon: { id: string; code: string; type: 'PERCENTAGE' | 'FIXED'; value: number }
}

export async function validateCouponPublic(code: string, subtotal: number): Promise<ValidateCouponResult> {
  const { data } = await menuApi.post('/menu/coupon/validate', { code, subtotal })
  return data.data
}
