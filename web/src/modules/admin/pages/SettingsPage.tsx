import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useOpenBillingPortal } from '../hooks/useBilling'
import {
  useStore,
  useUpdatePaymentSettings,
  useUpdatePix,
  useUpdateStore,
  useUpdateWhatsapp,
} from '../hooks/useStore'

import { PasswordInput } from '@/shared/components/PasswordInput'
import { resolveImageUrl } from '@/shared/lib/imageUrl'

type Tab = 'dados' | 'pagamentos' | 'assinatura'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dados', label: 'Dados' },
  { id: 'pagamentos', label: 'Pagamentos' },
  { id: 'assinatura', label: 'Assinatura' },
]

const PIX_TYPES = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'PHONE', label: 'Telefone' },
  { value: 'EVP', label: 'Chave Aleatória (EVP)' },
]

// ─── Sub-componentes por Tab ──────────────────────────────────────────────────

function TabDados() {
  const { data: store, isLoading } = useStore()
  const updateStoreMutation = useUpdateStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState('')
  const [address, setAddress] = useState('')
  const [initialized, setInitialized] = useState(false)

  if (store && !initialized) {
    setName(store.name ?? '')
    setDescription(store.description ?? '')
    setLogo(store.logo ?? '')
    setAddress(store.address ?? '')
    setInitialized(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    updateStoreMutation.mutate(
      { name, description, logo, address },
      { onError: () => alert('Erro ao salvar dados da loja.') }
    )
  }

  if (isLoading) {
    return <p className="text-sm text-gray-500 py-6 text-center">Carregando...</p>
  }

  return (
    <div className="space-y-8">
      {/* Dados da loja */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Dados da Loja</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo (URL)</label>
            <input
              type="url"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {logo && (
              <img
                src={resolveImageUrl(logo)}
                alt="Logo preview"
                className="mt-2 h-16 w-16 object-cover rounded-md border border-gray-200"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={updateStoreMutation.isPending}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateStoreMutation.isPending ? 'Salvando...' : 'Salvar Dados'}
            </button>
            {updateStoreMutation.isSuccess && (
              <span className="text-sm text-green-600">Salvo com sucesso!</span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function TabPagamentos() {
  const { data: store, isLoading } = useStore()
  const updateWhatsappMutation = useUpdateWhatsapp()
  const updatePixMutation = useUpdatePix()
  const updatePaymentMutation = useUpdatePaymentSettings()

  // WhatsApp form state
  const [phone, setPhone] = useState('')
  const [phonePassword, setPhonePassword] = useState('')

  // Pix form state
  const [pixKey, setPixKey] = useState('')
  const [pixKeyType, setPixKeyType] = useState('EVP')
  const [pixPassword, setPixPassword] = useState('')

  // Payment settings state
  const [allowCashOnDelivery, setAllowCashOnDelivery] = useState(false)
  const [allowPix, setAllowPix] = useState(false)
  const [allowPickup, setAllowPickup] = useState(false)
  const [serviceChargePercent, setServiceChargePercent] = useState(0)
  const [settingsInitialized, setSettingsInitialized] = useState(false)

  if (store && !settingsInitialized) {
    setPhone(store.phone ?? '')
    setPixKey(store.pixKey ?? '')
    setPixKeyType(store.pixKeyType ?? 'EVP')
    setAllowCashOnDelivery(store.allowCashOnDelivery)
    setAllowPix(store.features?.allowPix === true)
    setAllowPickup(store.allowPickup)
    setServiceChargePercent(store.serviceChargePercent)
    setSettingsInitialized(true)
  }

  function handleSaveWhatsapp(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim() || !phonePassword.trim()) return
    updateWhatsappMutation.mutate(
      { phone: phone.trim(), password: phonePassword },
      {
        onSuccess: () => setPhonePassword(''),
        onError: () => alert('Erro ao atualizar WhatsApp. Verifique a senha.'),
      }
    )
  }

  function handleSavePix(e: React.FormEvent) {
    e.preventDefault()
    if (!pixKey.trim() || !pixPassword.trim()) return
    updatePixMutation.mutate(
      { pixKey: pixKey.trim(), pixKeyType, password: pixPassword },
      {
        onSuccess: () => setPixPassword(''),
        onError: () => alert('Erro ao atualizar Pix. Verifique a senha.'),
      }
    )
  }

  function handleSavePaymentSettings(e: React.FormEvent) {
    e.preventDefault()
    updatePaymentMutation.mutate(
      { allowCashOnDelivery, allowPix, allowPickup, serviceChargePercent },
      { onError: () => alert('Erro ao salvar configurações de pagamento.') }
    )
  }

  if (isLoading) {
    return <p className="text-sm text-gray-500 py-6 text-center">Carregando...</p>
  }

  return (
    <div className="space-y-8">
      {/* WhatsApp */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-1">WhatsApp</h2>
        <p className="text-sm text-gray-500 mb-4">
          Requer confirmação de senha para alterar.
        </p>
        <form onSubmit={handleSaveWhatsapp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número do WhatsApp
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5511999999999"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar senha
            </label>
            <PasswordInput
              value={phonePassword}
              onChange={(e) => setPhonePassword(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={updateWhatsappMutation.isPending}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateWhatsappMutation.isPending ? 'Salvando...' : 'Salvar WhatsApp'}
            </button>
            {updateWhatsappMutation.isSuccess && (
              <span className="text-sm text-green-600">Atualizado com sucesso!</span>
            )}
          </div>
        </form>
      </div>

      {/* Pix */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Chave Pix</h2>
        <p className="text-sm text-gray-500 mb-4">
          Requer confirmação de senha para alterar.
        </p>
        <form onSubmit={handleSavePix} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Chave</label>
            <select
              value={pixKeyType}
              onChange={(e) => setPixKeyType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PIX_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chave Pix</label>
            <input
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar senha
            </label>
            <PasswordInput
              value={pixPassword}
              onChange={(e) => setPixPassword(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={updatePixMutation.isPending}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updatePixMutation.isPending ? 'Salvando...' : 'Salvar Pix'}
            </button>
            {updatePixMutation.isSuccess && (
              <span className="text-sm text-green-600">Atualizado com sucesso!</span>
            )}
          </div>
        </form>
      </div>

      {/* Formas de pagamento e taxa */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Formas de Pagamento e Entrega
        </h2>
        <form onSubmit={handleSavePaymentSettings} className="space-y-5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowPix}
              onChange={(e) => setAllowPix(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-800">Pix (online)</span>
              <p className="text-xs text-gray-500">
                Cliente paga via chave Pix antes da entrega e envia comprovante
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowCashOnDelivery}
              onChange={(e) => setAllowCashOnDelivery(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-800">Pagar na entrega</span>
              <p className="text-xs text-gray-500">
                Cartão de crédito, débito ou Pix no momento da entrega
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowPickup}
              onChange={(e) => setAllowPickup(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-800">Retirada na loja</span>
              <p className="text-xs text-gray-500">
                Permitir que o cliente retire o pedido no local (endereço exibido no checkout)
              </p>
            </div>
          </label>

          <div className="pt-2 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Taxa de Serviço (%)
            </label>
            <input
              type="number"
              value={serviceChargePercent}
              onChange={(e) => setServiceChargePercent(Number(e.target.value))}
              min={0}
              max={100}
              step={0.5}
              className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Percentual aplicado no fechamento de comandas (0 = desabilitado)
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={updatePaymentMutation.isPending}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updatePaymentMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
            </button>
            {updatePaymentMutation.isSuccess && (
              <span className="text-sm text-green-600">Salvo com sucesso!</span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}


// ─── Tab: Assinatura (Stripe Customer Portal) ────────────────────────────────

function TabAssinatura() {
  const { data: store, isLoading } = useStore()
  const openPortal = useOpenBillingPortal()

  if (isLoading) {
    return <div className="bg-white rounded-lg border border-gray-200 p-6">Carregando…</div>
  }

  const isTrial = store?.status === 'TRIAL'
  const trialEndsAt = store?.stripeTrialEndsAt
    ? new Date(store.stripeTrialEndsAt).toLocaleDateString('pt-BR')
    : null

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

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Assinatura e Pagamento</h2>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie forma de pagamento, veja faturas e histórico da sua assinatura.
        </p>
      </div>

      <div className="p-6 space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Plano atual</p>
              <p className="text-lg font-semibold text-gray-900">
                {store?.plan === 'PREMIUM' ? 'Premium' : 'Profissional'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-lg font-semibold text-gray-900">
                {isTrial ? 'Trial' : store?.status === 'ACTIVE' ? 'Ativo' : store?.status}
              </p>
            </div>
          </div>
          {isTrial && trialEndsAt && (
            <p className="text-sm text-amber-700 mt-3">
              Seu trial gratuito termina em <strong>{trialEndsAt}</strong>. Cadastre uma forma de
              pagamento antes dessa data para manter sua loja ativa.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleOpenPortal}
          disabled={openPortal.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          {openPortal.isPending ? 'Abrindo portal…' : 'Gerenciar assinatura no Stripe'}
        </button>

        <p className="text-xs text-gray-500 text-center">
          Você será redirecionado para o portal seguro do Stripe, onde pode adicionar/trocar cartão,
          baixar faturas e cancelar a assinatura.
        </p>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function SettingsPage() {
  const [searchParams] = useSearchParams()
  const initialTab = TABS.some((t) => t.id === searchParams.get('tab'))
    ? (searchParams.get('tab') as Tab)
    : 'dados'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Configurações da Loja</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo da Tab ativa */}
        {activeTab === 'dados' && <TabDados />}
        {activeTab === 'pagamentos' && <TabPagamentos />}
        {activeTab === 'assinatura' && <TabAssinatura />}
      </main>
    </div>
  )
}
