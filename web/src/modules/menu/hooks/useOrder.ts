import { useMutation } from '@tanstack/react-query'

import { submitOrder, type CreateOrderDto } from '../services/orders.service'

// ─── TASK-124: slug removido — submitOrder não recebe mais slug ──────────────
export function useCreateOrder(_slug: string) {
  return useMutation({
    mutationFn: (dto: CreateOrderDto) => submitOrder(dto),
  })
}
