import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  closeTable,
  createTable,
  fetchComanda,
  fetchTables,
  updateItemStatus,
  type CloseTableDto,
  type CreateTableDto,
} from '../services/tables.service'

export function useTables() {
  return useQuery({
    queryKey: ['tables'],
    queryFn: fetchTables,
  })
}

export function useCreateTable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateTableDto) => createTable(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables'] }),
  })
}

export function useCloseTable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CloseTableDto }) => closeTable(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] })
      qc.invalidateQueries({ queryKey: ['comanda'] })
    },
  })
}

export function useComanda(tableId: string | null) {
  return useQuery({
    queryKey: ['comanda', tableId],
    queryFn: () => fetchComanda(tableId!),
    enabled: !!tableId,
  })
}

export function useUpdateItemStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      tableId,
      itemId,
      status,
    }: {
      tableId: string
      itemId: string
      status: 'PENDING' | 'PREPARING' | 'DELIVERED'
    }) => updateItemStatus(tableId, itemId, status),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['comanda', variables.tableId] })
    },
  })
}
