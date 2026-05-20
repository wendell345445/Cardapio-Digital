import { createPublicApi } from '../../../shared/lib/publicApi'

const menuApi = createPublicApi()

export interface OrderAddress {
  zipCode?: string
  // neighborhood/city são opcionais no modo bairro (a cidade não é coletada
  // quando o cliente seleciona um bairro pré-cadastrado pela loja).
  street: string; number: string; complement?: string; neighborhood?: string; city?: string; state?: string
  /**
   * Cliente colou lat/lng do Google Maps quando o Google Geocoding não achou
   * o endereço (ex: loteamento novo, cidade pequena). Backend confia, pula
   * geocoding e calcula taxa direto contra a loja.
   */
  manualCoordinates?: { latitude: number; longitude: number }
}

export interface OrderItem {
  productId: string; variationId?: string; quantity: number; notes?: string
  /** v2.9: IDs de Addon (catálogo de adicionais), não mais ProductAdditional. */
  addonIds: string[]
}

export type PaymentMethod =
  | 'PIX'
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
  /** Token da TableSession (entry-point /mesa/:n). Obrigatório quando type=TABLE. */
  tableSessionToken?: string
  /** Nome informado pelo cliente no scan da mesa, atribuído ao pedido. */
  deviceName?: string
  scheduledFor?: string
  items: OrderItem[]
  /** Modo bairro: id do bairro escolhido no checkout. Quando setado, backend cobra a taxa fixa do bairro. */
  deliveryNeighborhoodId?: string
}

export interface OrderResult {
  orderId: string; orderNumber: number; token: string; total: number; status: string
  pixKey?: string; pixKeyType?: string
  /** QR Code Pix em data URL (`data:image/png;base64,...`). Só vem quando paymentMethod=PIX. */
  pixQrCode?: string
  /** Pix copia-e-cola (BR Code completo) pronto pra colar no app do banco. */
  pixCopyPaste?: string
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
  etaMin?: number
  neighborhoodId?: string
  neighborhoodName?: string
  /** true quando o subtotal cobre o limite de frete grátis e fee foi zerado */
  freeShippingApplied?: boolean
}

export async function calculateDeliveryFee(
  payload:
    | { latitude: number; longitude: number; subtotalCents?: number }
    | { neighborhoodId: string; subtotalCents?: number }
): Promise<DeliveryFeeResult> {
  const { data } = await menuApi.post('/menu/delivery/calculate', payload)
  return data.data
}

export interface PublicNeighborhood {
  id: string
  name: string
  fee: number
  etaMin: number
}

export async function listAvailableNeighborhoods(): Promise<PublicNeighborhood[]> {
  const { data } = await menuApi.get('/menu/delivery/neighborhoods')
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
