import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createAddon,
  createAddonCategory,
  deleteAddon,
  deleteAddonCategory,
  duplicateAddon,
  fetchAddonCategories,
  setProductAddons,
  updateAddon,
  updateAddonCategory,
} from '../services/additionals.service'

// ─── v2.9: hooks pra AddonCategory + Addon ───────────────────────────────────

export function useAddonCategories() {
  return useQuery({
    queryKey: ['addon-categories'],
    queryFn: fetchAddonCategories,
  })
}

// Categories

export function useCreateAddonCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createAddonCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addon-categories'] }),
  })
}

export function useUpdateAddonCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<{ name: string; order: number; isActive: boolean }> }) =>
      updateAddonCategory(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addon-categories'] }),
  })
}

export function useDeleteAddonCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteAddonCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addon-categories'] }),
  })
}

// Addons

export function useCreateAddon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createAddon,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addon-categories'] }),
  })
}

export function useUpdateAddon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Parameters<typeof updateAddon>[1] }) => updateAddon(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addon-categories'] }),
  })
}

export function useDeleteAddon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteAddon,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addon-categories'] }),
  })
}

export function useDuplicateAddon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: duplicateAddon,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addon-categories'] }),
  })
}

// Vínculo produto ↔ adicionais

export function useSetProductAddons() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, addonIds }: { productId: string; addonIds: string[] }) =>
      setProductAddons(productId, addonIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['addon-categories'] })
    },
  })
}
