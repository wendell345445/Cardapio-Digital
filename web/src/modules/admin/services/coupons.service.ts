import { api } from '@/shared/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CouponType = 'PERCENTAGE' | 'FIXED'

export interface Coupon {
  id: string
  code: string
  type: CouponType
  value: number
  minOrder?: number | null
  maxUses?: number | null
  usedCount: number
  startsAt?: string | null
  expiresAt?: string | null
  isActive: boolean
  createdAt: string
  productId?: string | null
  promoPrice?: number | null
  product?: { id: string; name: string; imageUrl: string | null; basePrice: number | null } | null
  totalSavings?: number
}

export interface CreateCouponData {
  code?: string
  type?: CouponType
  value?: number
  minOrder?: number
  maxUses?: number
  startsAt?: string
  expiresAt?: string
  productId?: string
  promoPrice?: number
}

export type UpdateCouponData = Partial<CreateCouponData & { isActive: boolean }>

// ─── API calls ────────────────────────────────────────────────────────────────

export async function listCoupons(params?: { isActive?: boolean; productId?: string }): Promise<Coupon[]> {
  const { data } = await api.get('/admin/coupons', { params })
  return data.data
}

export async function createCoupon(payload: CreateCouponData): Promise<Coupon> {
  const { data } = await api.post('/admin/coupons', payload)
  return data.data
}

export async function updateCoupon(id: string, payload: UpdateCouponData): Promise<Coupon> {
  const { data } = await api.patch(`/admin/coupons/${id}`, payload)
  return data.data
}

export async function deleteCoupon(id: string): Promise<void> {
  await api.delete(`/admin/coupons/${id}`)
}
