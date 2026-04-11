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
  expiresAt?: string | null
  isActive: boolean
  createdAt: string
}

export interface CreateCouponData {
  code: string
  type: CouponType
  value: number
  minOrder?: number
  maxUses?: number
  expiresAt?: string
}

export type UpdateCouponData = Partial<CreateCouponData & { isActive: boolean }>

// ─── API calls ────────────────────────────────────────────────────────────────

export async function listCoupons(isActive?: boolean): Promise<Coupon[]> {
  const { data } = await api.get('/admin/coupons', {
    params: isActive !== undefined ? { isActive } : undefined,
  })
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
