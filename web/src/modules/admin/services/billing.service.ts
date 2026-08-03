import { api } from '@/shared/lib/api'

interface CheckoutSessionResponse {
  url: string
}

export interface PixAutoResponse {
  authId: string
  status: string
  qrPayload: string
  qrImage: string
}

/**
 * POST /api/v1/billing/checkout-session — assinatura por CARTÃO.
 * Cria um Checkout hospedado no Asaas; retorna a URL pra redirecionar o admin.
 */
export async function createCheckoutSession(): Promise<CheckoutSessionResponse> {
  const { data } = await api.post<CheckoutSessionResponse>('/billing/checkout-session')
  return data
}

/**
 * POST /api/v1/billing/pix-auto — assinatura por PIX Automático.
 * Cria a autorização e retorna o QR (copia-e-cola + imagem) pra exibir no modal.
 */
export async function createPixAutoSubscription(): Promise<PixAutoResponse> {
  const { data } = await api.post<PixAutoResponse>('/billing/pix-auto')
  return data
}

/**
 * GET /api/v1/billing/pix-auto/status — polling do status da autorização PIX Automático.
 */
export async function getPixAutoStatus(): Promise<{ status: string | null }> {
  const { data } = await api.get<{ status: string | null }>('/billing/pix-auto/status')
  return data
}

// ─── Troca de plano ───────────────────────────────────────────────────────────

export type PlanName = 'PROFESSIONAL' | 'PREMIUM'

export interface ChangePlanPreview {
  currentPlan: PlanName
  targetPlan: PlanName
  direction: 'UPGRADE' | 'DOWNGRADE'
  chargeNow: number
  nextCycleValue: number
  nextDueDate: string
}

export async function getChangePlanPreview(targetPlan: PlanName): Promise<ChangePlanPreview> {
  const { data } = await api.get<ChangePlanPreview>('/billing/change-plan/preview', { params: { targetPlan } })
  return data
}

export async function changePlan(targetPlan: PlanName): Promise<{ direction: string; chargedNow: number }> {
  const { data } = await api.post<{ direction: string; chargedNow: number }>('/billing/change-plan', { targetPlan })
  return data
}
