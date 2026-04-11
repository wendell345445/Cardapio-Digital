import { AlertTriangle, ExternalLink, LogOut } from 'lucide-react'

import { useOpenBillingPortal } from '../hooks/useBilling'
import { useStore } from '../hooks/useStore'

import { logout as logoutService } from '@/modules/auth/services/auth.service'
import { useAuthStore } from '@/modules/auth/store/useAuthStore'


// ─── Tela de bloqueio para lojas SUSPENDED (Option B — bloqueio duro) ─────────
//
// Renderizada pelo `AdminLayout` quando `store.status === 'SUSPENDED'`. Substitui
// completamente o conteúdo do admin (sidebar + página interna) por uma tela única
// que oferece apenas duas ações: abrir o Stripe Customer Portal pra regularizar
// o pagamento, ou fazer logout.
//
// O backend complementa esse bloqueio negando todas as rotas /admin/* (com 403
// `code: STORE_SUSPENDED`) exceto `GET /admin/store` e `/billing/*`. Mesmo se o
// admin manipular o frontend, não consegue executar nenhuma ação de gestão.

export function SuspendedScreen() {
  const { data: store } = useStore()
  const openPortal = useOpenBillingPortal()
  const { logout: logoutLocal } = useAuthStore()

  function handleOpenPortal() {
    openPortal.mutate(undefined, {
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Não foi possível abrir o portal de assinatura. Tente novamente.'
        alert(msg)
      },
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
              assinatura não está ativa. Para reativar:
            </p>
            <ol className="mt-3 space-y-1.5 list-decimal list-inside text-gray-700">
              <li>Abra o portal de pagamento do Stripe</li>
              <li>Cadastre ou atualize sua forma de pagamento</li>
              <li>Confirme a assinatura — a loja volta automaticamente</li>
            </ol>
          </div>

          <button
            type="button"
            onClick={handleOpenPortal}
            disabled={openPortal.isPending}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            {openPortal.isPending ? 'Abrindo portal…' : 'Regularizar assinatura'}
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
    </div>
  )
}
