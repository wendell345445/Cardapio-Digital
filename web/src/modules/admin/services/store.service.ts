import { api } from '@/shared/lib/api'

// ─── TASK-050: Configurações — Dados da Loja e Horários ──────────────────────
// ─── TASK-051: Configurações — WhatsApp e Chave Pix ──────────────────────────
// ─── TASK-052: Configurações — Formas de Pagamento e Retirada ────────────────

export interface StoreData {
  id: string
  name: string
  slug: string
  customDomain?: string | null
  description?: string
  logo?: string
  address?: string
  phone?: string
  manualOpen: boolean | null
  pixKey?: string
  pixKeyType?: string
  allowCashOnDelivery: boolean
  allowPix: boolean
  allowPickup: boolean
  serviceChargePercent: number
  features: Record<string, boolean>
  plan?: string
  status?: string
  stripeTrialEndsAt?: string | null
  whatsappMode?: string
}

export interface BusinessHour {
  id: string
  storeId: string
  dayOfWeek: number
  openTime: string
  closeTime: string
  isClosed: boolean
}

export interface UpdateStoreDto {
  name?: string
  description?: string
  logo?: string
  address?: string
}

export interface UpdatePaymentSettingsDto {
  allowCashOnDelivery?: boolean
  allowPix?: boolean
  allowPickup?: boolean
  serviceChargePercent?: number
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchStore(): Promise<StoreData> {
  const { data } = await api.get('/admin/store')
  return data.data
}

export async function updateStore(dto: UpdateStoreDto): Promise<StoreData> {
  const { data } = await api.patch('/admin/store', dto)
  return data.data
}

export async function fetchBusinessHours(): Promise<BusinessHour[]> {
  const { data } = await api.get('/admin/store/hours')
  return data.data
}

export async function updateBusinessHours(dto: {
  hours: BusinessHour[]
}): Promise<BusinessHour[]> {
  const { data } = await api.put('/admin/store/hours', dto)
  return data.data
}

export async function updateStoreStatus(dto: {
  manualOpen: boolean | null
}): Promise<{ id: string; manualOpen: boolean | null }> {
  const { data } = await api.patch('/admin/store/status', dto)
  return data.data
}

export async function updateWhatsapp(dto: {
  phone: string
  password: string
}): Promise<{ id: string; phone: string }> {
  const { data } = await api.patch('/admin/store/whatsapp', dto)
  return data.data
}

export async function updatePix(dto: {
  pixKey: string
  pixKeyType: string
  password: string
}): Promise<{ id: string; pixKey: string; pixKeyType: string }> {
  const { data } = await api.patch('/admin/store/pix', dto)
  return data.data
}

export async function updatePaymentSettings(
  dto: UpdatePaymentSettingsDto
): Promise<StoreData> {
  const { data } = await api.patch('/admin/store/payment-settings', dto)
  return data.data
}
