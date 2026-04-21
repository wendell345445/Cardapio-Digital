import { api } from '@/shared/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DistanceRange {
  id: string
  minKm: number
  maxKm: number
  fee: number
}

export interface DeliveryConfig {
  latitude: number | null
  longitude: number | null
  addressLabel: string | null
  distances: DistanceRange[]
}

export interface CreateDistanceData {
  minKm: number
  maxKm: number
  fee: number
}

export type UpdateDistanceData = Partial<CreateDistanceData>

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getDeliveryConfig(): Promise<DeliveryConfig> {
  const { data } = await api.get('/admin/delivery')
  return data.data
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
  longitude: number,
  addressLabel?: string | null
): Promise<{ id: string; latitude: number; longitude: number; addressLabel: string | null }> {
  const payload: Record<string, unknown> = { latitude, longitude }
  if (addressLabel !== undefined) payload.addressLabel = addressLabel
  const { data } = await api.patch('/admin/delivery/coordinates', payload)
  return data.data
}

export interface GeocodeAddressPayload {
  cep?: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
}

export interface GeocodeResult {
  latitude: number
  longitude: number
  displayName?: string
}

export async function geocodeAddress(payload: GeocodeAddressPayload): Promise<GeocodeResult> {
  const { data } = await api.post('/admin/delivery/geocode', payload)
  return data.data
}
