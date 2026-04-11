import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createMotoboy,
  deleteMotoboy,
  fetchMotoboys,
  type CreateMotoboyDto,
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

export function useDeleteMotoboy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMotoboy(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['motoboys'] }),
  })
}
