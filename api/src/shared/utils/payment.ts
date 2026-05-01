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

/**
 * Métodos válidos pra cobrança presencial (mesa). Excluí *_ON_DELIVERY pra
 * deixar a coluna paymentMethod semanticamente limpa: pedido em mesa nunca
 * deveria sair com CASH_ON_DELIVERY (carrega a noção de "motoboy cobrou").
 */
export function isTablePaymentMethod(method: PaymentMethod): boolean {
  return (
    method === 'PIX' ||
    method === 'CASH' ||
    method === 'CREDIT' ||
    method === 'DEBIT'
  )
}
