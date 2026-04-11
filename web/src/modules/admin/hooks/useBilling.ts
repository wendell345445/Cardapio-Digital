import { useMutation } from '@tanstack/react-query'

import { createBillingPortalSession } from '../services/billing.service'

/**
 * Hook para abrir o Stripe Customer Portal. Ao clicar, chama o backend,
 * recebe a URL da sessão e redireciona a janela atual pra ela.
 * O Stripe redireciona de volta pro WEB_URL/admin/configuracoes após o fluxo.
 */
export function useOpenBillingPortal() {
  return useMutation({
    mutationFn: createBillingPortalSession,
    onSuccess: ({ url }) => {
      window.location.href = url
    },
  })
}
