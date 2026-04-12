import axios from 'axios'

// ─── TASK-122/124: slug vem do hostname (subdomain routing) ──────────────────
// A API resolve a loja pelo header Host da requisição (publicTenantMiddleware).
// A URL não carrega mais o slug — é sempre GET /api/v1/menu

// Dev: relativo (proxy do Vite). Prod: VITE_API_URL absoluto.
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1'

const menuApi = axios.create({ baseURL })

export interface ProductVariation { id: string; name: string; price: number; isActive: boolean }
export interface ProductAdditional { id: string; name: string; price: number; isActive: boolean }
export interface Product {
  id: string; name: string; description?: string; imageUrl?: string
  basePrice?: number; isActive: boolean; order: number
  variations: ProductVariation[]; additionals: ProductAdditional[]
  tags?: string[]
}
export interface Category { id: string; name: string; order: number; isActive: boolean; products: Product[] }
export interface StoreInfo {
  id: string; name: string; slug: string; description?: string; logo?: string
  address?: string; phone: string; pixKey?: string; pixKeyType?: string
  allowCashOnDelivery: boolean; allowPickup: boolean; storeStatus: 'open' | 'closed' | 'suspended'
  businessHours?: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>
  facebookPixelId?: string // TASK-096
}
export interface MenuData { store: StoreInfo; categories: Category[] }

export async function fetchMenu(): Promise<MenuData> {
  const { data } = await menuApi.get('/menu')
  return data.data
}
