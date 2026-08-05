import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ImageUpload } from '../components/ImageUpload'
import { MenuPreviewMock } from '../components/MenuPreviewMock'
import { useCreatePixAuto, useOpenCheckout } from '../hooks/useBilling'
import { PixAutoModal } from '../components/PixAutoModal'
import { ChangePlanModal } from '../components/ChangePlanModal'
import { type PixAutoResponse, type PlanName } from '../services/billing.service'
import {
  useStore,
  useUpdatePaymentSettings,
  useUpdatePix,
  useUpdateStore,
  useUpdateWhatsapp,
} from '../hooks/useStore'

import { toast } from '@/shared/lib/toast'
import { PasswordInput } from '@/shared/components/PasswordInput'
import { StoreAvatar } from '@/shared/components/StoreAvatar'
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
  const updateWhatsappMutation = useUpdateWhatsapp()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState('')
  const [address, setAddress] = useState('')
  const [initialized, setInitialized] = useState(false)

  const [phone, setPhone] = useState('')
  const [phonePassword, setPhonePassword] = useState('')
  const [phoneInitialized, setPhoneInitialized] = useState(false)

  if (store && !initialized) {
    setName(store.name ?? '')
    setDescription(store.description ?? '')
    setLogo(store.logo ?? '')
    setAddress(store.address ?? '')
    setInitialized(true)
  }

  if (store && !phoneInitialized) {
    setPhone(store.phone ?? '')
    setPhoneInitialized(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    updateStoreMutation.mutate(
      { name, description, logo, address },
      { onError: () => alert('Erro ao salvar dados da loja.') }
    )
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
    </div>
  )
}

function TabPagamentos() {
  const { data: store, isLoading } = useStore()
  const updatePixMutation = useUpdatePix()
  const updatePaymentMutation = useUpdatePaymentSettings()

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
    setPixKey(store.pixKey ?? '')
    setPixKeyType(store.pixKeyType ?? 'EVP')
    setAllowCashOnDelivery(store.allowCashOnDelivery)
    setAllowPix(store.features?.allowPix === true)
    setAllowPickup(store.allowPickup)
    setSettingsInitialized(true)
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
  const [initialized, setInitialized] = useState(false)

  if (store && !initialized) {
    setLogo(store.logo ?? '')
    setPrimaryColor(store.primaryColor ?? DEFAULT_PRIMARY)
    setSecondaryColor(store.secondaryColor ?? DEFAULT_SECONDARY)
    setInitialized(true)
  }

  function applyPreset(preset: PalettePreset) {
    setPrimaryColor(preset.primary)
    setSecondaryColor(preset.secondary)
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
            <StoreAvatar
              name={store?.name}
              logoUrl={logo || null}
              fallbackBg={primaryColor}
              size={96}
              className="shrink-0 border border-gray-200 shadow-sm"
            />
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
            Escolha uma paleta. A primária aparece em botões e destaques; a secundária,
            em fundos sutis e ícones.
          </p>

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {PALETTE_PRESETS.map((preset) => {
              const isActive = selectedPresetId === preset.id
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

// ─── Tab: Assinatura (Asaas — cartão via Checkout + PIX Automático) ───────────

function billingErrorMsg(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error ||
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    'Não foi possível iniciar a assinatura. Tente novamente.'
  )
}

function TabAssinatura() {
  const { data: store, isLoading } = useStore()
  const openCheckout = useOpenCheckout()
  const createPixAuto = useCreatePixAuto()
  const [pixData, setPixData] = useState<PixAutoResponse | null>(null)
  const [changePlanTarget, setChangePlanTarget] = useState<PlanName | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()

  const checkoutResult = searchParams.get('assinatura') // 'ok' | 'cancelado' | 'expirado' | null
  const isActiveNow = store?.status === 'ACTIVE'
  // "Confirmando" = voltou do checkout com sucesso mas o webhook ainda não ativou.
  // O cartão pode levar de segundos a poucos minutos pra capturar no Asaas.
  const [confirming, setConfirming] = useState(checkoutResult === 'ok')

  // Feedback do retorno do checkout de cartão (?assinatura=cancelado|expirado): avisa e
  // limpa a query string pra não repetir o toast a cada re-render.
  useEffect(() => {
    if (checkoutResult === 'cancelado') {
      toast.info('Pagamento cancelado', 'Você pode tentar assinar novamente quando quiser.')
      setSearchParams({}, { replace: true })
    } else if (checkoutResult === 'expirado') {
      toast.error('Checkout expirado', 'O tempo do pagamento acabou. Gere um novo para assinar.')
      setSearchParams({}, { replace: true })
    }
  }, [checkoutResult, setSearchParams])

  // Ao voltar do checkout com sucesso (?assinatura=ok), a confirmação chega pelo webhook
  // do Asaas de forma assíncrona. Enquanto a loja não estiver ACTIVE, refazemos o fetch
  // de ['store'] a cada 4s (por ~2min) pra a tela refletir a ativação sem recarregar.
  useEffect(() => {
    if (checkoutResult !== 'ok') return
    if (isActiveNow) {
      // Chegou a ativação: comemora, para o loading e limpa a query string.
      setConfirming(false)
      toast.success('Assinatura ativada!', 'Seu pagamento foi confirmado. Loja ativa. 🎉')
      setSearchParams({}, { replace: true })
      return
    }
    let ticks = 0
    const id = setInterval(() => {
      ticks += 1
      qc.invalidateQueries({ queryKey: ['store'] })
      if (ticks >= 30) {
        clearInterval(id)
        setConfirming(false) // desiste do spinner após ~2min; o webhook ainda pode chegar depois
      }
    }, 4000)
    return () => clearInterval(id)
  }, [checkoutResult, isActiveNow, qc, setSearchParams])

  if (isLoading) {
    return <div className="bg-white rounded-lg border border-gray-200 p-6">Carregando…</div>
  }

  const isTrial = store?.status === 'TRIAL'
  const isActive = store?.status === 'ACTIVE'
  const isPremium = store?.plan === 'PREMIUM'
  const trialEndsAt = store?.trialEndsAt
    ? new Date(store.trialEndsAt).toLocaleDateString('pt-BR')
    : null

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

  const busy = openCheckout.isPending || createPixAuto.isPending

  // Loja ATIVA já pagou — não mostra "Assinar", só o plano e a troca de plano.
  // Trial/Suspensa/etc mostram os botões de assinar pra regularizar.
  const showSubscribeButtons = !isActive
  // Troca de plano só faz sentido pra assinatura por CARTÃO e sem downgrade já agendado.
  const canChangePlan = isActive && store?.billingMethod === 'CARD' && !store?.pendingPlan
  const showUpgrade = canChangePlan && !isPremium
  const showDowngrade = canChangePlan && isPremium
  const pendingLabel =
    store?.pendingPlan === 'PROFESSIONAL' ? 'Profissional' : store?.pendingPlan === 'PREMIUM' ? 'Premium' : null

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Assinatura e Pagamento</h2>
        <p className="text-sm text-gray-500 mt-1">
          {isActive
            ? 'Sua assinatura está ativa.'
            : 'Escolha como pagar sua assinatura: cartão de crédito (recorrência automática) ou PIX Automático (débito automático mensal).'}
        </p>
      </div>

      <div className="p-6 space-y-4">
        {confirming && !isActive && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4"
          >
            <Loader2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-blue-900">Recebemos seu pagamento</p>
              <p className="text-sm text-blue-800">
                Estamos confirmando com o Asaas — isso pode levar alguns instantes. A tela atualiza
                sozinha assim que a assinatura for ativada.
              </p>
            </div>
          </div>
        )}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Plano atual</p>
              <p className="text-lg font-semibold text-gray-900">
                {isPremium ? 'Premium' : 'Profissional'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Status</p>
              <p
                className={`text-lg font-semibold ${isActive ? 'text-green-600' : 'text-gray-900'}`}
              >
                {isTrial ? 'Trial' : isActive ? 'Ativo' : store?.status}
              </p>
            </div>
          </div>
          {isTrial && trialEndsAt && (
            <p className="text-sm text-amber-700 mt-3">
              Seu trial gratuito termina em <strong>{trialEndsAt}</strong>. Assine antes dessa data
              para manter sua loja ativa.
            </p>
          )}
        </div>

        {showSubscribeButtons && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCard}
                disabled={busy}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                {openCheckout.isPending ? 'Abrindo…' : 'Assinar com cartão'}
              </button>
              <button
                type="button"
                onClick={handlePix}
                disabled={busy}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                {createPixAuto.isPending ? 'Gerando QR…' : 'Assinar com PIX (automático)'}
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center">
              No cartão você é redirecionado para o checkout seguro do Asaas. No PIX Automático,
              escaneie o QR uma vez para autorizar os débitos mensais.
            </p>
          </>
        )}

        {pendingLabel && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              Mudança para <strong>{pendingLabel}</strong> agendada para o próximo ciclo. Você mantém
              os recursos do plano atual até lá.
            </p>
          </div>
        )}

        {showUpgrade && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">Quer mais recursos?</p>
            <p className="text-sm text-blue-800 mt-0.5">
              No plano <strong>Premium</strong> você libera atendimento com IA no WhatsApp, cupons,
              analytics e entrega por zonas.
            </p>
            <button
              type="button"
              onClick={() => setChangePlanTarget('PREMIUM')}
              className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
            >
              Fazer upgrade para Premium
            </button>
          </div>
        )}

        {showDowngrade && (
          <button
            type="button"
            onClick={() => setChangePlanTarget('PROFESSIONAL')}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
          >
            Mudar para o plano Profissional
          </button>
        )}
      </div>

      {pixData && <PixAutoModal data={pixData} onClose={() => setPixData(null)} />}
      {changePlanTarget && (
        <ChangePlanModal targetPlan={changePlanTarget} onClose={() => setChangePlanTarget(null)} />
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function SettingsPage() {
  const [searchParams] = useSearchParams()
  // Abre a tab Assinatura quando: ?tab=assinatura OU o retorno do checkout Asaas
  // (?assinatura=ok|cancelado|expirado — callback do fluxo de cartão).
  const initialTab: Tab = TABS.some((t) => t.id === searchParams.get('tab'))
    ? (searchParams.get('tab') as Tab)
    : searchParams.has('assinatura')
      ? 'assinatura'
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
