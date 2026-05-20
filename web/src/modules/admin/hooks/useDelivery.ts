import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createDistance,
  createNeighborhood,
  deleteDistance,
  deleteNeighborhood,
  getDeliveryConfig,
  setStoreCoordinates,
  updateDeliverySettings,
  updateDistance,
  updateNeighborhood,
  type CreateDistanceData,
  type CreateNeighborhoodData,
  type DeliverySettings,
  type UpdateDistanceData,
  type UpdateNeighborhoodData,
} from '../services/delivery.service'

// ─── Query ────────────────────────────────────────────────────────────────────

export function useDeliveryConfig() {
  return useQuery({
    queryKey: ['delivery-config'],
    queryFn: getDeliveryConfig,
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

// Coordinates

export function useSetStoreCoordinates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      latitude,
      longitude,
      addressLabel,
    }: {
      latitude: number
      longitude: number
      addressLabel?: string | null
    }) => setStoreCoordinates(latitude, longitude, addressLabel),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-config'] })
    },
  })
}

// Settings (prepTimeMin, freeDeliveryAboveCents)

export function useUpdateDeliverySettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<DeliverySettings>) => updateDeliverySettings(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-config'] })
    },
  })
}

// Distances

export function useCreateDistance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateDistanceData) => createDistance(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-config'] })
    },
  })
}

export function useUpdateDistance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDistanceData }) =>
      updateDistance(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-config'] })
    },
  })
}

export function useDeleteDistance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDistance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-config'] })
    },
  })
}

// Neighborhoods

export function useCreateNeighborhood() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateNeighborhoodData) => createNeighborhood(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-config'] })
    },
  })
}

export function useUpdateNeighborhood() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNeighborhoodData }) =>
      updateNeighborhood(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-config'] })
    },
  })
}

export function useDeleteNeighborhood() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteNeighborhood(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-config'] })
    },
  })
}
