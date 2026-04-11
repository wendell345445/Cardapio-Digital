import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addAdjustment,
  closeCashFlow,
  getCashFlowSummary,
  getCurrentCashFlow,
  listCashFlows,
  openCashFlow,
  updateInitialAmount,
  type AdjustmentType,
} from '../services/cashflow.service'

// ─── Query Keys ───────────────────────────────────────────────────────────────

const KEYS = {
  all: ['cashflows'] as const,
  current: ['cashflows', 'current'] as const,
  summary: (id: string) => ['cashflows', id, 'summary'] as const,
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useListCashFlows() {
  return useQuery({
    queryKey: KEYS.all,
    queryFn: listCashFlows,
  })
}

export function useCurrentCashFlow() {
  return useQuery({
    queryKey: KEYS.current,
    queryFn: getCurrentCashFlow,
    retry: false,
  })
}

export function useCashFlowSummary(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.summary(id ?? ''),
    queryFn: () => getCashFlowSummary(id!),
    enabled: Boolean(id),
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useOpenCashFlow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (initialAmount: number) => openCashFlow(initialAmount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      qc.invalidateQueries({ queryKey: KEYS.current })
    },
  })
}

export function useUpdateInitialAmount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, initialAmount }: { id: string; initialAmount: number }) =>
      updateInitialAmount(id, initialAmount),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.current })
      qc.invalidateQueries({ queryKey: KEYS.summary(id) })
    },
  })
}

export function useAddAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      type,
      amount,
      notes,
    }: {
      id: string
      type: AdjustmentType
      amount: number
      notes?: string
    }) => addAdjustment(id, type, amount, notes),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.current })
      qc.invalidateQueries({ queryKey: KEYS.summary(id) })
    },
  })
}

export function useCloseCashFlow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      countedAmount,
      justification,
    }: {
      id: string
      countedAmount: number
      justification?: string
    }) => closeCashFlow(id, countedAmount, justification),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      qc.invalidateQueries({ queryKey: KEYS.current })
    },
  })
}
