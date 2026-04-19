import { createPublicApi } from '../../../shared/lib/publicApi'

const menuApi = createPublicApi()

export interface ProductVariation { id: string; name: string; price: number; isActive: boolean }
export interface ProductAdditional { id: string; name: string; price: number; isActive: boolean }
export interface Product {
  id: string; name: string; description?: string; imageUrl?: string
  basePrice?: number; isActive: boolean; order: number
  variations: ProductVariation[]; additionals: ProductAdditional[]
  tags?: string[]
  promoPrice?: number | null
  promoStartsAt?: string | null
  promoExpiresAt?: string | null
}
export interface Category { id: string; name: string; order: number; isActive: boolean; products: Product[] }
export interface StoreInfo {
  id: string; name: string; slug: string; description?: string; logo?: string
  address?: string; phone: string; pixKey?: string; pixKeyType?: string
  allowCashOnDelivery: boolean; allowPickup: boolean; allowCreditCard: boolean; allowDelivery: boolean
  features?: { allowPix?: boolean } | null
  storeStatus: 'open' | 'closed' | 'suspended'
  businessHours?: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>
  facebookPixelId?: string // TASK-096
}
export interface MenuData { store: StoreInfo; categories: Category[] }

export async function fetchMenu(): Promise<MenuData> {
  const { data } = await menuApi.get('/menu')
  return data.data
}
