import { api } from '@/shared/lib/api'

// ─── TASK-041: Produtos CRUD Individual ──────────────────────────────────────

export interface ProductVariation {
  id: string
  productId: string
  name: string
  price: number
  isActive: boolean
}

export interface ProductAdditional {
  id: string
  productId: string
  name: string
  price: number
  isActive: boolean
}

export interface Product {
  id: string
  storeId: string
  categoryId: string
  name: string
  description?: string
  imageUrl?: string
  basePrice?: number
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
  variations: ProductVariation[]
  additionals: ProductAdditional[]
}

export interface VariationDto {
  id?: string
  name: string
  price: number
  isActive?: boolean
}

export interface AdditionalDto {
  id?: string
  name: string
  price: number
  isActive?: boolean
}

export interface CreateProductDto {
  categoryId: string
  name: string
  description?: string
  imageUrl: string // RN-006: foto obrigatória
  basePrice?: number
  isActive?: boolean
  order?: number
  variations?: VariationDto[]
  additionals?: AdditionalDto[]
}

export interface UpdateProductDto {
  categoryId?: string
  name?: string
  description?: string
  imageUrl?: string
  basePrice?: number
  isActive?: boolean
  order?: number
  variations?: VariationDto[]
  additionals?: AdditionalDto[]
}

export interface ProductFilters {
  search?: string
  categoryId?: string
  isActive?: boolean
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchProducts(filters?: ProductFilters): Promise<Product[]> {
  const { data } = await api.get('/admin/products', { params: filters })
  return data.data
}

export async function fetchProduct(id: string): Promise<Product> {
  const { data } = await api.get(`/admin/products/${id}`)
  return data.data
}

export async function createProduct(dto: CreateProductDto): Promise<Product> {
  const { data } = await api.post('/admin/products', dto)
  return data.data
}

export async function updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
  const { data } = await api.patch(`/admin/products/${id}`, dto)
  return data.data
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/admin/products/${id}`)
}

export async function duplicateProduct(id: string): Promise<Product> {
  const { data } = await api.post(`/admin/products/${id}/duplicate`)
  return data.data
}
