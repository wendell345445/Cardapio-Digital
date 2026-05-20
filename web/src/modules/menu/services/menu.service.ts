import { createPublicApi } from '../../../shared/lib/publicApi'

const menuApi = createPublicApi()

export interface ProductVariation { id: string; name: string; price: number; isActive: boolean }

// v2.9: cardápio público traz adicionais via ProductAddon (N:N) com Addon + AddonCategory aninhados.
export interface PublicAddon {
  id: string
  name: string
  price: number
  imageUrl?: string | null
  isActive: boolean
  order: number
  category: { id: string; name: string; order: number }
}
export interface ProductAddonLink {
  productId: string
  addonId: string
  order: number
  addon: PublicAddon
}

export interface Product {
  id: string; name: string; description?: string; imageUrl?: string
  basePrice?: number; isActive: boolean; order: number
  variations: ProductVariation[]
  addons: ProductAddonLink[]
  tags?: string[]
  promoPrice?: number | null
  promoStartsAt?: string | null
  promoExpiresAt?: string | null
}
export interface Category { id: string; name: string; order: number; isActive: boolean; products: Product[] }
export interface StoreInfo {
  id: string; name: string; slug: string; description?: string; logo?: string
  primaryColor?: string | null
  secondaryColor?: string | null
  address?: string; phone: string; pixKey?: string; pixKeyType?: string
  allowCashOnDelivery: boolean; allowPickup: boolean; allowDelivery: boolean
  deliveryByDistanceEnabled?: boolean
  deliveryByNeighborhoodEnabled?: boolean
  features?: { allowPix?: boolean } | null
  storeStatus: 'open' | 'closed' | 'suspended'
  nextOpenLabel?: string | null
  businessHours?: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>
  facebookPixelId?: string // TASK-096
}
export interface MenuData { store: StoreInfo; categories: Category[] }

export async function fetchMenu(): Promise<MenuData> {
  const { data } = await menuApi.get('/menu')
  return data.data
}
