import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  closeTable,
  confirmTablePayment,
  createTable,
  fetchClosedSessions,
  fetchComanda,
  fetchTables,
  setTablesCount,
  updateItemStatus,
  type CloseTableDto,
  type CreateTableDto,
  type TablePaymentMethod,
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
      qc.invalidateQueries({ queryKey: ['tables'] })
    },
  })
}

export function useSetTablesCount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (count: number) => setTablesCount(count),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables'] }),
  })
}

export function useClosedSessions(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['tables', 'history', params?.from ?? null, params?.to ?? null],
    queryFn: () => fetchClosedSessions(params),
    staleTime: 30_000,
  })
}

export function useConfirmTablePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      tableId,
      paymentMethod,
    }: {
      tableId: string
      paymentMethod: TablePaymentMethod
    }) => confirmTablePayment(tableId, paymentMethod),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['comanda', variables.tableId] })
      qc.invalidateQueries({ queryKey: ['tables'] })
    },
  })
}
