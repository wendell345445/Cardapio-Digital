import { useQueryClient } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  changePlan,
  getChangePlanPreview,
  type ChangePlanPreview,
  type PlanName,
} from '../services/billing.service'

import { toast } from '@/shared/lib/toast'

interface Props {
  targetPlan: PlanName
  onClose: () => void
}

const PLAN_LABEL: Record<PlanName, string> = { PROFESSIONAL: 'Profissional', PREMIUM: 'Premium' }

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function errMsg(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    'Não foi possível concluir. Tente novamente.'
  )
}

/**
 * Modal de confirmação de troca de plano. Busca o preview (quanto será cobrado agora,
 * valor do próximo ciclo) e explica o comportamento antes de confirmar:
 *  • UPGRADE → cobra a diferença proporcional AGORA no cartão.
 *  • DOWNGRADE → nada agora; mantém o plano atual até o fim do ciclo, muda no próximo.
 */
export function ChangePlanModal({ targetPlan, onClose }: Props) {
  const qc = useQueryClient()
  const [preview, setPreview] = useState<ChangePlanPreview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let alive = true
    getChangePlanPreview(targetPlan)
      .then((p) => alive && setPreview(p))
      .catch((e) => alive && setLoadError(errMsg(e)))
    return () => {
      alive = false
    }
  }, [targetPlan])

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const res = await changePlan(targetPlan)
      await qc.invalidateQueries({ queryKey: ['store'] })
      if (res.direction === 'UPGRADE') {
        toast.success('Plano atualizado!', `Premium ativo. Cobrado ${fmtBRL(res.chargedNow)} proporcional.`)
      } else {
        toast.success('Downgrade agendado', 'Você mantém o plano atual até o fim do ciclo.')
      }
      onClose()
    } catch (e) {
      toast.error('Erro ao trocar de plano', errMsg(e))
    } finally {
      setSubmitting(false)
    }
  }

  const isUpgrade = preview?.direction === 'UPGRADE'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {isUpgrade ? 'Fazer upgrade' : 'Mudar de plano'} para {PLAN_LABEL[targetPlan]}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : !preview ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Calculando…
            </div>
          ) : isUpgrade ? (
            <>
              <div className="rounded-lg bg-gray-50 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Cobrança agora (proporcional)</span>
                  <span className="font-semibold text-gray-900">{fmtBRL(preview.chargeNow)}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-gray-600">A partir de {fmtDate(preview.nextDueDate)}</span>
                  <span className="font-semibold text-gray-900">{fmtBRL(preview.nextCycleValue)}/mês</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Cobramos apenas a diferença proporcional aos dias restantes do ciclo atual, no seu
                cartão. O Premium é liberado imediatamente.
              </p>
            </>
          ) : (
            <>
              <div className="rounded-lg bg-gray-50 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Cobrança agora</span>
                  <span className="font-semibold text-green-600">{fmtBRL(0)}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-gray-600">A partir de {fmtDate(preview.nextDueDate)}</span>
                  <span className="font-semibold text-gray-900">{fmtBRL(preview.nextCycleValue)}/mês</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Nada é cobrado agora. Você <strong>mantém os recursos do plano atual até{' '}
                {fmtDate(preview.nextDueDate)}</strong> (fim do ciclo já pago). A partir daí, sua
                assinatura passa a ser {PLAN_LABEL[targetPlan]}.
              </p>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!preview || submitting}
              className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {submitting ? 'Processando…' : isUpgrade ? 'Confirmar upgrade' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
