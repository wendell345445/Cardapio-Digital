import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Store,
  Unplug,
} from 'lucide-react'
import { useState } from 'react'

import { useStore } from '../hooks/useStore'
import {
  applyCatalogImport,
  disconnectIFood,
  getIFoodStatus,
  linkIFoodMerchant,
  previewIFoodMerchant,
  previewCatalogImport,
  type CatalogImportPreview,
  type IFoodMerchantPreview,
} from '../services/ifood.service'

import { toast } from '@/shared/lib/toast'

function errMsg(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    'Ocorreu um erro. Tente novamente.'
  )
}

export function IFoodPage() {
  const { data: store } = useStore()
  const qc = useQueryClient()
  const isPremium = store?.plan === 'PREMIUM'

  const statusQuery = useQuery({
    queryKey: ['ifood', 'status'],
    queryFn: getIFoodStatus,
    enabled: isPremium,
  })
  const connected = statusQuery.data?.status === 'CONNECTED'

  // Vínculo por merchantId informado pelo lojista (isolamento multi-tenant).
  const [merchantIdInput, setMerchantIdInput] = useState('')
  const [merchantPreview, setMerchantPreview] = useState<IFoodMerchantPreview | null>(null)
  const [checking, setChecking] = useState(false)
  const [linking, setLinking] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // Import de catálogo (aparece quando conectado)
  const [preview, setPreview] = useState<CatalogImportPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [importing, setImporting] = useState(false)

  async function handleCheckMerchant() {
    const id = merchantIdInput.trim()
    if (!id) return
    setChecking(true)
    try {
      setMerchantPreview(await previewIFoodMerchant(id))
    } catch (e) {
      toast.error('Não foi possível validar a loja', errMsg(e))
    } finally {
      setChecking(false)
    }
  }

  async function handleLink() {
    if (!merchantPreview) return
    setLinking(true)
    try {
      await linkIFoodMerchant(merchantPreview.id)
      await qc.invalidateQueries({ queryKey: ['ifood', 'status'] })
      setMerchantPreview(null)
      setMerchantIdInput('')
      toast.success('iFood conectado!', 'Sua loja iFood está vinculada.')
    } catch (e) {
      toast.error('Erro ao vincular', errMsg(e))
    } finally {
      setLinking(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await disconnectIFood()
      await qc.invalidateQueries({ queryKey: ['ifood', 'status'] })
      setMerchantPreview(null)
      setMerchantIdInput('')
      setPreview(null)
      toast.success('iFood desconectado')
    } catch (e) {
      toast.error('Erro ao desconectar', errMsg(e))
    } finally {
      setDisconnecting(false)
    }
  }

  async function handlePreviewImport() {
    setLoadingPreview(true)
    try {
      setPreview(await previewCatalogImport())
    } catch (e) {
      toast.error('Erro ao ler o catálogo do iFood', errMsg(e))
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleConfirmImport() {
    setImporting(true)
    try {
      const res = await applyCatalogImport()
      await qc.invalidateQueries({ queryKey: ['products'] })
      await qc.invalidateQueries({ queryKey: ['categories'] })
      setPreview(null)
      toast.success(
        'Catálogo importado!',
        `${res.products} produto(s) em ${res.categories} categoria(s).`
      )
    } catch (e) {
      toast.error('Erro ao importar o catálogo', errMsg(e))
    } finally {
      setImporting(false)
    }
  }

  // ─── Gate Premium ────────────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Integração iFood</h1>
        <div className="rounded-lg border border-red-100 bg-red-50 p-6 max-w-2xl">
          <p className="text-red-900 font-semibold">Funcionalidade do plano Premium</p>
          <p className="text-red-800 text-sm mt-1">
            A integração com o iFood — receber pedidos no painel e importar seu cardápio — está
            disponível no plano <strong>Premium</strong>. Faça upgrade em Minha Loja → Assinatura.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Integração iFood</h1>
      <p className="text-sm text-gray-500 mb-6">
        Conecte a loja do iFood para receber pedidos no seu painel e importar o cardápio.
      </p>

      {/* Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 mb-4">
        {statusQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : connected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-gray-900">Conectado</p>
                <p className="text-sm text-gray-500">
                  {statusQuery.data?.merchantName || statusQuery.data?.merchantId}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
            >
              <Unplug className="h-4 w-4" />
              {disconnecting ? 'Desconectando…' : 'Desconectar'}
            </button>
          </div>
        ) : (
          <div>
            <p className="font-semibold text-gray-900">Não conectado</p>
            <ol className="text-sm text-gray-500 mt-2 space-y-1 list-decimal list-inside">
              <li>
                No <strong>Portal do Parceiro iFood</strong>, autorize o app{' '}
                <strong>Menu Panda</strong> na sua loja.
              </li>
              <li>
                Copie o <strong>ID da sua loja</strong> no iFood (um código UUID) e cole abaixo.
              </li>
            </ol>
            <a
              href="https://portal.ifood.com.br"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
            >
              Abrir Portal do Parceiro <ExternalLink className="h-3 w-3" />
            </a>

            {merchantPreview ? (
              // Conferência antes de vincular
              <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <Store className="h-5 w-5 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {merchantPreview.corporateName || merchantPreview.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {[merchantPreview.city, merchantPreview.state].filter(Boolean).join(' / ') ||
                        merchantPreview.id}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">É esta a sua loja no iFood?</p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleLink}
                    disabled={linking}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {linking ? 'Vinculando…' : 'Sim, vincular'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMerchantPreview(null)}
                    disabled={linking}
                    className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    Não, corrigir ID
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={merchantIdInput}
                  onChange={(e) => setMerchantIdInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCheckMerchant()}
                  placeholder="ID da sua loja no iFood (UUID)"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none"
                />
                <button
                  type="button"
                  onClick={handleCheckMerchant}
                  disabled={checking || !merchantIdInput.trim()}
                  className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
                >
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {checking ? 'Validando…' : 'Continuar'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Importar catálogo (quando conectado) */}
      {connected && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 mb-4">
          <div className="flex items-start gap-3">
            <Download className="h-6 w-6 text-gray-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Importar cardápio do iFood</p>
              <p className="text-sm text-gray-500 mt-1">
                Traz categorias, produtos e adicionais da sua loja no iFood para o Menu Panda. Não
                altera nada no iFood — é só leitura. Produtos já existentes (mesmo nome) são
                atualizados, não duplicados.
              </p>

              {preview ? (
                <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">Vai importar:</p>
                  <ul className="text-sm text-gray-700 space-y-0.5">
                    <li>• {preview.categories} categoria(s)</li>
                    <li>• {preview.products} produto(s)</li>
                    <li>
                      • {preview.addons} adicional(is) em {preview.addonCategories} grupo(s)
                    </li>
                  </ul>
                  {preview.warnings.length > 0 && (
                    <div className="mt-3 flex gap-2 text-xs text-amber-700">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <ul className="space-y-0.5">
                        {preview.warnings.slice(0, 6).map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                        {preview.warnings.length > 6 && (
                          <li>+{preview.warnings.length - 6} outro(s) aviso(s)…</li>
                        )}
                      </ul>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={importing}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                      {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {importing ? 'Importando…' : 'Confirmar importação'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreview(null)}
                      disabled={importing}
                      className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handlePreviewImport}
                  disabled={loadingPreview}
                  className="mt-4 flex items-center gap-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {loadingPreview ? 'Lendo catálogo…' : 'Importar cardápio'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
