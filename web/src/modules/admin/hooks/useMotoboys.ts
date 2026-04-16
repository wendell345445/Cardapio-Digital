import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createMotoboy,
  deleteMotoboy,
  fetchMotoboys,
  setMotoboyAvailability,
  updateMotoboy,
  type CreateMotoboyDto,
  type UpdateMotoboyDto,
} from '../services/motoboys.service'

// ─── TASK-053: Hooks de motoboys ─────────────────────────────────────────────

export function useMotoboys() {
  return useQuery({
    queryKey: ['motoboys'],
    queryFn: fetchMotoboys,
  })
}

export function useCreateMotoboy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateMotoboyDto) => createMotoboy(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['motoboys'] }),
  })
}

export function useUpdateMotoboy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateMotoboyDto }) => updateMotoboy(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['motoboys'] }),
  })
}

export function useDeleteMotoboy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMotoboy(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['motoboys'] }),
  })
}

export function useSetMotoboyAvailability() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) =>
      setMotoboyAvailability(id, available),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['motoboys'] }),
  })
}
