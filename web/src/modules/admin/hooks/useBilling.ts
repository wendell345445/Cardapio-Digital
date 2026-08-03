import { useMutation } from '@tanstack/react-query'

import { createCheckoutSession, createPixAutoSubscription } from '../services/billing.service'

/**
 * Hook para assinar por CARTÃO. Chama o backend, recebe a URL do Checkout
 * hospedado do Asaas e redireciona a janela atual pra ela. O Asaas redireciona
 * de volta pro WEB_URL/admin/configuracoes após o fluxo.
 */
export function useOpenCheckout() {
  return useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: ({ url }) => {
      window.location.href = url
    },
  })
}

/**
 * Hook para assinar por PIX Automático. Retorna o QR de autorização (payload +
 * imagem) pro componente exibir; a ativação chega via webhook (status da loja).
 */
export function useCreatePixAuto() {
  return useMutation({
    mutationFn: createPixAutoSubscription,
  })
}
