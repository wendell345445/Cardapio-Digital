import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'


import { useOpenBillingPortal } from '../hooks/useBilling'
import { useAddPaymentAccess, useRemovePaymentAccess, useStoreClients } from '../hooks/usePaymentAccess'
import {
  useCreateMotoboy,
  useDeleteMotoboy,
  useMotoboys,
  useUpdateMotoboy,
} from '../hooks/useMotoboys'
import type { Motoboy } from '../services/motoboys.service'
import {
  useStore,
  useUpdatePaymentSettings,
  useUpdatePix,
  useUpdateStore,
  useUpdateWhatsapp,
} from '../hooks/useStore'

import { resolveImageUrl } from '@/shared/lib/imageUrl'
// ─── TASK-050/051/052/053/054: Página de Configurações da Loja ───────────────
// ─── TASK-109/Epic10: Aba "Mensagens WhatsApp" movida para WhatsAppPage ───────
// ─── Epic 13 hardening: Aba "Assinatura" (Stripe Customer Portal) ─────────────

type Tab = 'dados' | 'pagamentos' | 'motoboys' | 'acesso' | 'assinatura'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dados', label: 'Dados' },
  { id: 'pagamentos', label: 'Pagamentos' },
  { id: 'motoboys', label: 'Motoboys' },
  { id: 'acesso', label: 'Blacklist/Whitelist' },
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
  const [allowCreditCard, setAllowCreditCard] = useState(false)
  const [serviceChargePercent, setServiceChargePercent] = useState(0)
  const [settingsInitialized, setSettingsInitialized] = useState(false)

  if (store && !settingsInitialized) {
    setPhone(store.phone ?? '')
    setPixKey(store.pixKey ?? '')
    setPixKeyType(store.pixKeyType ?? 'EVP')
    setAllowCashOnDelivery(store.allowCashOnDelivery)
    setAllowPix(store.allowPix)
    setAllowPickup(store.allowPickup)
    setAllowCreditCard(store.allowCreditCard ?? false)
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
      { allowCashOnDelivery, allowPix, allowPickup, allowCreditCard, serviceChargePercent },
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
            <input
              type="password"
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
            <input
              type="password"
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
              <span className="text-sm font-medium text-gray-800">Pix</span>
              <p className="text-xs text-gray-500">Aceitar pagamento via Pix</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowCreditCard}
              onChange={(e) => setAllowCreditCard(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-800">Cartão de Crédito (online)</span>
              <p className="text-xs text-gray-500">
                Exibir a opção no checkout. Integração com gateway será habilitada em breve.
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

type MotoboyToast = { message: string; type: 'success' | 'error' } | null

function MotoboyToastView({ toast, onClose }: { toast: MotoboyToast; onClose: () => void }) {
  if (!toast) return null
  return (
    <div
      role="alert"
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-sm font-medium ${
        toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      }`}
    >
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-1 opacity-80 hover:opacity-100" aria-label="Fechar">
        <X size={14} />
      </button>
    </div>
  )
}

function extractApiError(err: unknown, fallback: string): string {
  const maybe = err as { response?: { data?: { error?: string; message?: string } } }
  return maybe?.response?.data?.error ?? maybe?.response?.data?.message ?? fallback
}

function EditMotoboyModal({
  motoboy,
  onClose,
  onToast,
}: {
  motoboy: Motoboy
  onClose: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}) {
  const updateMutation = useUpdateMotoboy()
  const [name, setName] = useState(motoboy.name)
  const [whatsapp, setWhatsapp] = useState(motoboy.whatsapp ?? '')
  const [email, setEmail] = useState(motoboy.email ?? '')
  const [password, setPassword] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const dto = {
      name: name.trim(),
      whatsapp: whatsapp.trim() ? whatsapp.trim() : null,
      email: email.trim() ? email.trim() : null,
      ...(password ? { password } : {}),
    }
    updateMutation.mutate(
      { id: motoboy.id, dto },
      {
        onSuccess: () => {
          onToast('Motoboy atualizado!', 'success')
          onClose()
        },
        onError: (err) => onToast(extractApiError(err, 'Erro ao atualizar motoboy.'), 'error'),
      }
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Editar Motoboy</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="5511999999999"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nova senha <span className="text-xs text-gray-400">(deixe em branco para manter)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TabMotoboys() {
  const { data: motoboys, isLoading, isError } = useMotoboys()
  const createMutation = useCreateMotoboy()
  const deleteMutation = useDeleteMotoboy()

  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [toast, setToast] = useState<MotoboyToast>(null)
  const [editing, setEditing] = useState<Motoboy | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !password.trim()) return
    createMutation.mutate(
      {
        name: name.trim(),
        ...(whatsapp.trim() && { whatsapp: whatsapp.trim() }),
        ...(email.trim() && { email: email.trim() }),
        password,
      },
      {
        onSuccess: () => {
          setName('')
          setWhatsapp('')
          setEmail('')
          setPassword('')
          showToast('Motoboy adicionado!', 'success')
        },
        onError: (err) => showToast(extractApiError(err, 'Erro ao adicionar motoboy.'), 'error'),
      }
    )
  }

  function handleDelete(id: string, motoboyName: string) {
    if (!window.confirm(`Remover o motoboy "${motoboyName}"?`)) return
    deleteMutation.mutate(id, {
      onSuccess: () => showToast('Motoboy removido.', 'success'),
      onError: (err) => showToast(extractApiError(err, 'Erro ao remover motoboy.'), 'error'),
    })
  }

  return (
    <div className="space-y-8">
      <MotoboyToastView toast={toast} onClose={() => setToast(null)} />

      {/* Formulário inline */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Adicionar Motoboy</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="5511999999999"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? 'Adicionando...' : 'Adicionar Motoboy'}
          </button>
        </form>
      </div>

      {/* Listagem */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Motoboys Cadastrados</h2>
        </div>

        {isLoading && (
          <p className="px-6 py-8 text-sm text-gray-500 text-center">Carregando...</p>
        )}

        {isError && (
          <p className="px-6 py-8 text-sm text-red-600 text-center">
            Erro ao carregar motoboys.
          </p>
        )}

        {motoboys && motoboys.length === 0 && (
          <p className="px-6 py-8 text-sm text-gray-500 text-center">
            Nenhum motoboy cadastrado.
          </p>
        )}

        {motoboys && motoboys.length > 0 && (
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Nome</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">WhatsApp</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">E-mail</th>
                <th className="px-6 py-3 text-right font-medium text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {motoboys.map((motoboy) => (
                <tr key={motoboy.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{motoboy.name}</td>
                  <td className="px-6 py-4 text-gray-600">{motoboy.whatsapp ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-600">{motoboy.email ?? '—'}</td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button
                      onClick={() => setEditing(motoboy)}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(motoboy.id, motoboy.name)}
                      disabled={deleteMutation.isPending}
                      className="text-red-600 hover:underline text-xs font-medium disabled:opacity-50"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <EditMotoboyModal
          motoboy={editing}
          onClose={() => setEditing(null)}
          onToast={showToast}
        />
      )}
    </div>
  )
}

function TabAcesso() {
  const { data: clients, isLoading, isError } = useStoreClients()
  const addMutation = useAddPaymentAccess()
  const removeMutation = useRemovePaymentAccess()

  function handleAdd(clientId: string, type: 'BLACKLIST' | 'WHITELIST') {
    addMutation.mutate(
      { clientId, type },
      { onError: () => alert('Erro ao atualizar acesso do cliente.') }
    )
  }

  function handleRemove(clientId: string) {
    removeMutation.mutate(clientId, {
      onError: () => alert('Erro ao remover acesso do cliente.'),
    })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-800">Blacklist / Whitelist de Clientes</h2>
        <p className="text-sm text-gray-500 mt-1">
          Apenas clientes com histórico de pedido na loja aparecem aqui.
        </p>
      </div>

      {isLoading && (
        <p className="px-6 py-8 text-sm text-gray-500 text-center">Carregando clientes...</p>
      )}

      {isError && (
        <p className="px-6 py-8 text-sm text-red-600 text-center">
          Erro ao carregar clientes.
        </p>
      )}

      {clients && clients.length === 0 && (
        <p className="px-6 py-8 text-sm text-gray-500 text-center">
          Nenhum cliente com histórico encontrado.
        </p>
      )}

      {clients && clients.length > 0 && (
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-600">Nome</th>
              <th className="px-6 py-3 text-left font-medium text-gray-600">WhatsApp</th>
              <th className="px-6 py-3 text-center font-medium text-gray-600">Acesso</th>
              <th className="px-6 py-3 text-right font-medium text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{client.name}</td>
                <td className="px-6 py-4 text-gray-600">{client.whatsapp ?? '—'}</td>
                <td className="px-6 py-4 text-center">
                  {client.accessType === 'BLACKLIST' ? (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">
                      Blacklist
                    </span>
                  ) : client.accessType === 'WHITELIST' ? (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                      Whitelist
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
                      Nenhum
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleAdd(client.id, 'BLACKLIST')}
                      disabled={addMutation.isPending || client.accessType === 'BLACKLIST'}
                      className="px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      Blacklist
                    </button>
                    <button
                      onClick={() => handleAdd(client.id, 'WHITELIST')}
                      disabled={addMutation.isPending || client.accessType === 'WHITELIST'}
                      className="px-2 py-1 rounded bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 disabled:opacity-50 transition-colors"
                    >
                      Whitelist
                    </button>
                    {client.accessId && (
                      <button
                        onClick={() => handleRemove(client.id)}
                        disabled={removeMutation.isPending}
                        className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        {activeTab === 'motoboys' && <TabMotoboys />}
        {activeTab === 'acesso' && <TabAcesso />}
        {activeTab === 'assinatura' && <TabAssinatura />}
      </main>
    </div>
  )
}
