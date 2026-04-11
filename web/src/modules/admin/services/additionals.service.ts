import { api } from '@/shared/lib/api'

export interface AdditionalItem {
  id: string
  name: string
  price: number
  isActive: boolean
  productId: string
}

export interface AdditionalGroup {
  id: string          // productId
  name: string        // product name (used as group label)
  categoryName: string
  isActive: boolean
  items: AdditionalItem[]
}

export async function fetchAdditionals(): Promise<AdditionalGroup[]> {
  const { data } = await api.get('/admin/additionals')
  return data.data
}

export async function updateAdditionalItem(
  itemId: string,
  dto: Partial<{ name: string; price: number; isActive: boolean }>
): Promise<AdditionalItem> {
  const { data } = await api.patch(`/admin/additionals/items/${itemId}`, dto)
  return data.data
}

export async function createAdditionalItem(
  productId: string,
  dto: { name: string; price: number }
): Promise<AdditionalItem> {
  const { data } = await api.post(`/admin/additionals/${productId}/items`, dto)
  return data.data
}

export async function deleteAdditionalItem(itemId: string): Promise<void> {
  await api.delete(`/admin/additionals/items/${itemId}`)
}
