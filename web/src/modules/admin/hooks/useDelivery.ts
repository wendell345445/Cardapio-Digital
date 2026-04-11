import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createDistance,
  createNeighborhood,
  deleteDistance,
  deleteNeighborhood,
  getDeliveryConfig,
  setDeliveryMode,
  updateDistance,
  updateNeighborhood,
  type CreateDistanceData,
  type CreateNeighborhoodData,
  type DeliveryMode,
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

export function useSetDeliveryMode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mode: DeliveryMode) => setDeliveryMode(mode),
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
