import { api } from '@/shared/lib/api'

export interface Category {
  id: string
  storeId: string
  name: string
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateCategoryDto {
  name: string
  order?: number
}

export interface UpdateCategoryDto {
  name?: string
  order?: number
  isActive?: boolean
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await api.get('/admin/categories')
  return data.data
}

export async function createCategory(dto: CreateCategoryDto): Promise<Category> {
  const { data } = await api.post('/admin/categories', dto)
  return data.data
}

export async function updateCategory(id: string, dto: UpdateCategoryDto): Promise<Category> {
  const { data } = await api.patch(`/admin/categories/${id}`, dto)
  return data.data
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/admin/categories/${id}`)
}
