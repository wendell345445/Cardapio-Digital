import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createDistance,
  deleteDistance,
  getDeliveryConfig,
  setStoreCoordinates,
  updateDistance,
  type CreateDistanceData,
  type UpdateDistanceData,
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
