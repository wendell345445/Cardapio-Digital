import { api } from '@/shared/lib/api'

interface PortalSessionResponse {
  url: string
}

/**
 * POST /api/v1/billing/portal-session
 * Chama o backend para criar uma Stripe Customer Portal session.
 * Retorna a URL pra onde redirecionar o admin.
 */
export async function createBillingPortalSession(): Promise<PortalSessionResponse> {
  const { data } = await api.post<PortalSessionResponse>('/billing/portal-session')
  return data
}
