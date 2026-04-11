import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createAdditionalItem,
  deleteAdditionalItem,
  fetchAdditionals,
  updateAdditionalItem,
} from '../services/additionals.service'

export function useAdditionals() {
  return useQuery({
    queryKey: ['additionals'],
    queryFn: fetchAdditionals,
  })
}

export function useUpdateAdditionalItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<{ name: string; price: number; isActive: boolean }> }) =>
      updateAdditionalItem(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['additionals'] }),
  })
}

export function useCreateAdditionalItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, dto }: { productId: string; dto: { name: string; price: number } }) =>
      createAdditionalItem(productId, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['additionals'] }),
  })
}

export function useDeleteAdditionalItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => deleteAdditionalItem(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['additionals'] }),
  })
}
