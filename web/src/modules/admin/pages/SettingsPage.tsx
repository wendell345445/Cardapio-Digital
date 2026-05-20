import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ImageUpload } from '../components/ImageUpload'
import { MenuPreviewMock } from '../components/MenuPreviewMock'
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
import {
  DEFAULT_PRIMARY,
  DEFAULT_SECONDARY,
  PALETTE_PRESETS,
  type PalettePreset,
} from '@/shared/lib/theme'

type Tab = 'dados' | 'personalizacao' | 'pagamentos' | 'assinatura'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dados', label: 'Dados' },
  { id: 'personalizacao', label: 'Personalização' },
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
  const [settingsInitialized, setSettingsInitialized] = useState(false)

  if (store && !settingsInitialized) {
    setPhone(store.phone ?? '')
    setPixKey(store.pixKey ?? '')
    setPixKeyType(store.pixKeyType ?? 'EVP')
    setAllowCashOnDelivery(store.allowCashOnDelivery)
    setAllowPix(store.features?.allowPix === true)
    setAllowPickup(store.allowPickup)
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
      { allowCashOnDelivery, allowPix, allowPickup },
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


// ─── Tab: Personalização (logo + cores do cardápio) ──────────────────────────

function TabPersonalizacao() {
  const { data: store, isLoading } = useStore()
  const updateStoreMutation = useUpdateStore()

  // Estado local — mexe instantâneo, salva sob demanda. Permite o preview ao
  // lado refletir mudanças sem persistir até clicar em "Salvar".
  const [logo, setLogo] = useState<string>('')
  const [primaryColor, setPrimaryColor] = useState<string>(DEFAULT_PRIMARY)
  const [secondaryColor, setSecondaryColor] = useState<string>(DEFAULT_SECONDARY)
  const [showCustom, setShowCustom] = useState(false)
  const [initialized, setInitialized] = useState(false)

  if (store && !initialized) {
    setLogo(store.logo ?? '')
    setPrimaryColor(store.primaryColor ?? DEFAULT_PRIMARY)
    setSecondaryColor(store.secondaryColor ?? DEFAULT_SECONDARY)
    // Se a cor salva não bate em nenhum preset, abrir picker custom já aberto.
    const matchesPreset = PALETTE_PRESETS.some(
      (p) =>
        p.primary.toLowerCase() === (store.primaryColor ?? DEFAULT_PRIMARY).toLowerCase()
    )
    setShowCustom(!matchesPreset)
    setInitialized(true)
  }

  function applyPreset(preset: PalettePreset) {
    setPrimaryColor(preset.primary)
    setSecondaryColor(preset.secondary)
    setShowCustom(false)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    updateStoreMutation.mutate(
      {
        logo: logo.trim() || null,
        primaryColor,
        secondaryColor,
      },
      { onError: () => alert('Erro ao salvar personalização.') }
    )
  }

  function handleResetDefault() {
    setPrimaryColor(DEFAULT_PRIMARY)
    setSecondaryColor(DEFAULT_SECONDARY)
    setShowCustom(false)
  }

  if (isLoading) {
    return <p className="text-sm text-gray-500 py-6 text-center">Carregando...</p>
  }

  const selectedPresetId =
    PALETTE_PRESETS.find(
      (p) => p.primary.toLowerCase() === primaryColor.toLowerCase()
    )?.id ?? null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
      {/* Coluna esquerda — controles */}
      <form onSubmit={handleSave} className="space-y-6 min-w-0">
        {/* Logo */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Logo da loja</h2>
          <p className="text-sm text-gray-500 mb-4">
            Aparece no topo do cardápio público. JPG, PNG ou WebP, até 5MB.
          </p>
          <div className="flex items-start gap-4">
            <div className="h-24 w-24 shrink-0 rounded-full overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
              {logo ? (
                <img
                  src={resolveImageUrl(logo)}
                  alt="Logo"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs text-gray-400">Sem logo</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <ImageUpload value={logo} onChange={setLogo} uploadType="logos" />
              {logo && (
                <button
                  type="button"
                  onClick={() => setLogo('')}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remover logo
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Cores */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Cores do cardápio</h2>
          <p className="text-sm text-gray-500 mb-4">
            Escolha uma paleta predefinida ou personalize. A primária aparece em botões e
            destaques; a secundária, em fundos sutis e ícones.
          </p>

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-5">
            {PALETTE_PRESETS.map((preset) => {
              const isActive = selectedPresetId === preset.id && !showCustom
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  title={preset.label}
                  className={`relative h-10 w-10 rounded-full transition-transform ${
                    isActive ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: preset.primary }}
                  aria-label={`Paleta ${preset.label}`}
                >
                  <span
                    className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: preset.secondary }}
                  />
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowCustom((s) => !s)}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {showCustom ? 'Fechar personalização' : 'Personalizar cor (HEX)'}
          </button>

          {showCustom && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <ColorPickerField
                label="Cor primária"
                helper="Botões, links, badges"
                value={primaryColor}
                onChange={setPrimaryColor}
              />
              <ColorPickerField
                label="Cor secundária"
                helper="Fundos sutis, ícones"
                value={secondaryColor}
                onChange={setSecondaryColor}
              />
            </div>
          )}
        </section>

        {/* Ações */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updateStoreMutation.isPending}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {updateStoreMutation.isPending ? 'Salvando...' : 'Salvar personalização'}
          </button>
          <button
            type="button"
            onClick={handleResetDefault}
            className="text-sm text-gray-600 hover:underline"
          >
            Restaurar padrão
          </button>
          {updateStoreMutation.isSuccess && (
            <span className="text-sm text-green-600">Salvo com sucesso!</span>
          )}
        </div>
      </form>

      {/* Coluna direita — preview pegajoso */}
      <aside className="lg:sticky lg:top-6">
        <MenuPreviewMock
          storeName={store?.name ?? 'Sua loja'}
          logoUrl={logo || null}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
        />
      </aside>
    </div>
  )
}

interface ColorPickerFieldProps {
  label: string
  helper: string
  value: string
  onChange: (v: string) => void
}

function ColorPickerField({ label, helper, value, onChange }: ColorPickerFieldProps) {
  function handleHexInput(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value.trim()
    if (v && !v.startsWith('#')) v = `#${v}`
    onChange(v)
  }

  const isValidHex = /^#[0-9a-fA-F]{6}$/.test(value)

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <p className="text-xs text-gray-500 mb-2">{helper}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isValidHex ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 rounded-md border border-gray-300 cursor-pointer"
          aria-label={`Escolher ${label.toLowerCase()}`}
        />
        <input
          type="text"
          value={value.toUpperCase()}
          onChange={handleHexInput}
          maxLength={7}
          className={`flex-1 rounded-md border px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 ${
            isValidHex
              ? 'border-gray-300 focus:ring-blue-500'
              : 'border-red-300 focus:ring-red-500'
          }`}
          placeholder="#000000"
        />
      </div>
      {!isValidHex && (
        <p className="mt-1 text-xs text-red-600">Use o formato #RRGGBB.</p>
      )}
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
        <h1 className="text-xl font-bold text-gray-900">Minha Loja</h1>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
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
        {activeTab === 'personalizacao' && <TabPersonalizacao />}
        {activeTab === 'pagamentos' && <TabPagamentos />}
        {activeTab === 'assinatura' && <TabAssinatura />}
      </main>
    </div>
  )
}
