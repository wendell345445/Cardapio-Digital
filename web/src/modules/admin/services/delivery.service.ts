import { api } from '@/shared/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeliveryMode = 'NEIGHBORHOOD' | 'DISTANCE' | null

export interface Neighborhood {
  id: string
  name: string
  fee: number
}

export interface DistanceRange {
  id: string
  minKm: number
  maxKm: number
  fee: number
}

export interface DeliveryConfig {
  mode: DeliveryMode
  latitude: number | null
  longitude: number | null
  neighborhoods: Neighborhood[]
  distances: DistanceRange[]
}

export interface CreateNeighborhoodData {
  name: string
  fee: number
}

export type UpdateNeighborhoodData = Partial<CreateNeighborhoodData>

export interface CreateDistanceData {
  minKm: number
  maxKm: number
  fee: number
}

export type UpdateDistanceData = Partial<CreateDistanceData>

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getDeliveryConfig(): Promise<DeliveryConfig> {
  const { data } = await api.get('/admin/delivery')
  const raw = data.data
  return { ...raw, mode: raw.deliveryMode ?? null }
}

export async function setDeliveryMode(mode: DeliveryMode): Promise<DeliveryConfig> {
  const { data } = await api.patch('/admin/delivery/mode', { mode })
  return data.data
}

export async function createNeighborhood(payload: CreateNeighborhoodData): Promise<Neighborhood> {
  const { data } = await api.post('/admin/delivery/neighborhoods', payload)
  return data.data
}

export async function updateNeighborhood(
  id: string,
  payload: UpdateNeighborhoodData
): Promise<Neighborhood> {
  const { data } = await api.patch(`/admin/delivery/neighborhoods/${id}`, payload)
  return data.data
}

export async function deleteNeighborhood(id: string): Promise<void> {
  await api.delete(`/admin/delivery/neighborhoods/${id}`)
}

export async function createDistance(payload: CreateDistanceData): Promise<DistanceRange> {
  const { data } = await api.post('/admin/delivery/distances', payload)
  return data.data
}

export async function updateDistance(
  id: string,
  payload: UpdateDistanceData
): Promise<DistanceRange> {
  const { data } = await api.patch(`/admin/delivery/distances/${id}`, payload)
  return data.data
}

export async function deleteDistance(id: string): Promise<void> {
  await api.delete(`/admin/delivery/distances/${id}`)
}

export async function setStoreCoordinates(
  latitude: number,
  longitude: number
): Promise<{ id: string; latitude: number; longitude: number }> {
  const { data } = await api.patch('/admin/delivery/coordinates', { latitude, longitude })
  return data.data
}
