import { AlertTriangle, ExternalLink, LogOut, QrCode } from 'lucide-react'
import { useState } from 'react'

import { useCreatePixAuto, useOpenCheckout } from '../hooks/useBilling'
import { useStore } from '../hooks/useStore'
import { type PixAutoResponse } from '../services/billing.service'

import { PixAutoModal } from './PixAutoModal'

import { logout as logoutService } from '@/modules/auth/services/auth.service'
import { useAuthStore } from '@/modules/auth/store/useAuthStore'
import { toast } from '@/shared/lib/toast'


// ─── Tela de bloqueio para lojas SUSPENDED (Option B — bloqueio duro) ─────────
//
// Renderizada pelo `AdminLayout` quando `store.status === 'SUSPENDED'`. Substitui
// completamente o conteúdo do admin (sidebar + página interna) por uma tela única
// que oferece regularizar o pagamento (cartão ou PIX Automático) ou fazer logout.
//
// O backend complementa esse bloqueio negando todas as rotas /admin/* (com 403
// `code: STORE_SUSPENDED`) exceto `GET /admin/store` e `/billing/*`. Mesmo se o
// admin manipular o frontend, não consegue executar nenhuma ação de gestão.

function billingErrorMsg(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error ||
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    'Não foi possível iniciar a assinatura. Tente novamente.'
  )
}

export function SuspendedScreen() {
  const { data: store } = useStore()
  const openCheckout = useOpenCheckout()
  const createPixAuto = useCreatePixAuto()
  const { logout: logoutLocal } = useAuthStore()
  const [pixData, setPixData] = useState<PixAutoResponse | null>(null)

  function handleCard() {
    openCheckout.mutate(undefined, {
      onError: (err: unknown) => toast.error('Erro ao assinar', billingErrorMsg(err)),
    })
  }

  function handlePix() {
    createPixAuto.mutate(undefined, {
      onSuccess: (data) => setPixData(data),
      onError: (err: unknown) => toast.error('Erro ao gerar PIX', billingErrorMsg(err)),
    })
  }

  async function handleLogout() {
    const refreshToken = sessionStorage.getItem('refresh_token')
    if (refreshToken) {
      await logoutService(refreshToken).catch(() => null)
    }
    logoutLocal()
    window.location.href = '/login'
  }

  const busy = openCheckout.isPending || createPixAuto.isPending

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-red-50 border-b border-red-100 px-6 py-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Loja suspensa</h1>
            <p className="text-sm text-gray-600 mt-0.5">
              {store?.name ? `${store.name} está` : 'Sua loja está'} temporariamente fora do ar.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="text-sm text-gray-600 leading-relaxed">
            <p>
              O acesso ao painel administrativo e ao cardápio público foi bloqueado porque a
              assinatura não está ativa. Escolha uma forma de pagamento para reativar — a loja volta
              automaticamente após a confirmação.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCard}
            disabled={busy}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            {openCheckout.isPending ? 'Abrindo…' : 'Regularizar com cartão'}
          </button>

          <button
            type="button"
            onClick={handlePix}
            disabled={busy}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            {createPixAuto.isPending ? 'Gerando QR…' : 'Regularizar com PIX automático'}
          </button>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sair da conta
          </button>
        </div>
      </div>

      {pixData && <PixAutoModal data={pixData} onClose={() => setPixData(null)} />}
    </div>
  )
}
