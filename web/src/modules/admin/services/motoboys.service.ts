import { api } from '@/shared/lib/api'

// ─── TASK-053: Configurações — Cadastro de Motoboys ──────────────────────────

export interface Motoboy {
  id: string
  name: string
  whatsapp?: string
  email?: string
  storeId: string
  role: string
  isActive: boolean
  createdAt: string
}

export interface CreateMotoboyDto {
  name: string
  whatsapp?: string
  email?: string
  password: string
}

export interface UpdateMotoboyDto {
  name?: string
  whatsapp?: string | null
  email?: string | null
  password?: string
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchMotoboys(): Promise<Motoboy[]> {
  const { data } = await api.get('/admin/store/motoboys')
  return data.data
}

export async function createMotoboy(dto: CreateMotoboyDto): Promise<Motoboy> {
  const { data } = await api.post('/admin/store/motoboys', dto)
  return data.data
}

export async function updateMotoboy(id: string, dto: UpdateMotoboyDto): Promise<Motoboy> {
  const { data } = await api.patch(`/admin/store/motoboys/${id}`, dto)
  return data.data
}

export async function deleteMotoboy(id: string): Promise<void> {
  await api.delete(`/admin/store/motoboys/${id}`)
}
