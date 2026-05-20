import { api } from '@/shared/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DistanceRange {
  id: string
  maxKm: number
  fee: number
  etaMin: number
  isAvailable: boolean
  sortOrder?: number
}

export interface Neighborhood {
  id: string
  name: string
  fee: number
  etaMin: number
  isAvailable: boolean
  sortOrder?: number
}

export interface DeliverySettings {
  prepTimeMin: number
  freeDeliveryAboveCents: number | null
}

export interface DeliveryConfig extends DeliverySettings {
  latitude: number | null
  longitude: number | null
  addressLabel: string | null
  distances: DistanceRange[]
  neighborhoods: Neighborhood[]
}

export interface CreateDistanceData {
  maxKm: number
  fee: number
  etaMin: number
  isAvailable: boolean
}

export type UpdateDistanceData = Partial<CreateDistanceData>

export interface CreateNeighborhoodData {
  name: string
  fee: number
  etaMin: number
  isAvailable: boolean
}

export type UpdateNeighborhoodData = Partial<CreateNeighborhoodData>

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getDeliveryConfig(): Promise<DeliveryConfig> {
  const { data } = await api.get('/admin/delivery')
  return data.data
}

export async function updateDeliverySettings(
  payload: Partial<DeliverySettings>
): Promise<DeliverySettings & { id: string }> {
  const { data } = await api.patch('/admin/delivery/settings', payload)
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

export async function createNeighborhood(
  payload: CreateNeighborhoodData
): Promise<Neighborhood> {
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
