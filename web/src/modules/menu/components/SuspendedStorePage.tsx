import { AlertCircle } from 'lucide-react'

// ─── Página pública para lojas SUSPENDED (Option B — bloqueio duro) ───────────
//
// Renderizada por MenuPage / ItemPage / CheckoutPage quando a API retorna
// `store.storeStatus === 'suspended'`. Substitui completamente o cardápio,
// produtos e checkout — o cliente final só vê uma mensagem informando que a
// loja está temporariamente fora do ar, sem listar produtos nem permitir pedido.
//
// O backend complementa esse bloqueio em `orders.service.ts` recusando criação
// de pedido com 422 quando store.status === SUSPENDED.

interface Props {
  storeName?: string
}

export function SuspendedStorePage({ storeName }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-b from-amber-900 to-amber-700 px-6 py-8 flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3">
            <AlertCircle className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white text-center">
            Cardápio temporariamente indisponível
          </h1>
        </div>

        <div className="p-6 space-y-3 text-center">
          <p className="text-gray-700">
            {storeName ? <strong>{storeName}</strong> : 'Esta loja'} está fora do ar no momento.
          </p>
          <p className="text-sm text-gray-500">
            Volte mais tarde — assim que a loja retomar a operação, o cardápio fica disponível
            novamente para fazer seu pedido.
          </p>
        </div>
      </div>
    </div>
  )
}
