import { api } from '@/shared/lib/api'

// ─── v2.9: AddonCategory + Addon (substitui shape antigo agrupado por produto) ──

export interface AddonCategory {
  id: string
  storeId: string
  name: string
  order: number
  isActive: boolean
  addons: Addon[]
}

export interface Addon {
  id: string
  storeId: string
  categoryId: string
  name: string
  price: number
  imageUrl: string | null
  isActive: boolean
  order: number
  category?: { id: string; name: string }
}

// ── AddonCategory CRUD ──────────────────────────────────────────────────────

export async function fetchAddonCategories(): Promise<AddonCategory[]> {
  const { data } = await api.get('/admin/additionals/categories')
  return data.data
}

export async function createAddonCategory(dto: { name: string; order?: number }): Promise<AddonCategory> {
  const { data } = await api.post('/admin/additionals/categories', dto)
  return data.data
}

export async function updateAddonCategory(
  id: string,
  dto: Partial<{ name: string; order: number; isActive: boolean }>
): Promise<AddonCategory> {
  const { data } = await api.patch(`/admin/additionals/categories/${id}`, dto)
  return data.data
}

export async function deleteAddonCategory(id: string): Promise<void> {
  await api.delete(`/admin/additionals/categories/${id}`)
}

// ── Addon CRUD ──────────────────────────────────────────────────────────────

export async function createAddon(dto: {
  categoryId: string
  name: string
  price: number
  imageUrl?: string | null
  order?: number
}): Promise<Addon> {
  const { data } = await api.post('/admin/additionals', dto)
  return data.data
}

export async function updateAddon(
  id: string,
  dto: Partial<{ name: string; price: number; imageUrl: string | null; isActive: boolean; categoryId: string; order: number }>
): Promise<Addon> {
  const { data } = await api.patch(`/admin/additionals/${id}`, dto)
  return data.data
}

export async function deleteAddon(id: string): Promise<void> {
  await api.delete(`/admin/additionals/${id}`)
}

export async function duplicateAddon(id: string): Promise<Addon> {
  const { data } = await api.post(`/admin/additionals/${id}/duplicate`)
  return data.data
}

// ── Vínculo produto ↔ adicionais ────────────────────────────────────────────

export async function setProductAddons(productId: string, addonIds: string[]): Promise<void> {
  await api.put(`/admin/additionals/products/${productId}`, { addonIds })
}
