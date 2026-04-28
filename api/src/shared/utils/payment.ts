import { PaymentMethod } from '@prisma/client'

/**
 * Métodos cobrados na entrega — exigem confirmação manual de recebimento
 * pelo motoboy ou admin antes do pedido ser marcado como DELIVERED.
 */
export function isPaymentOnDelivery(method: PaymentMethod): boolean {
  return (
    method === 'CASH_ON_DELIVERY' ||
    method === 'CREDIT_ON_DELIVERY' ||
    method === 'DEBIT_ON_DELIVERY' ||
    method === 'PIX_ON_DELIVERY'
  )
}
