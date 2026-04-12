import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createCoupon,
  deleteCoupon,
  listCoupons,
  updateCoupon,
  type CreateCouponData,
  type UpdateCouponData,
} from '../services/coupons.service'

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useCoupons(filters?: { isActive?: boolean; productId?: string }) {
  return useQuery({
    queryKey: ['coupons', filters ?? {}],
    queryFn: () => listCoupons(filters),
  })
}

export function useProductPromo(productId: string | undefined) {
  return useQuery({
    queryKey: ['coupons', { productId }],
    queryFn: () => listCoupons({ productId }),
    enabled: !!productId,
    select: (coupons) =>
      coupons.find((c) => c.productId === productId && c.isActive) ?? null,
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCouponData) => createCoupon(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coupons'] })
    },
  })
}

export function useUpdateCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCouponData }) =>
      updateCoupon(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coupons'] })
    },
  })
}

export function useDeleteCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCoupon(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coupons'] })
    },
  })
}
