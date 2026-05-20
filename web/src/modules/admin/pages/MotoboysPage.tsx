import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, X } from 'lucide-react'

import { useStore } from '../hooks/useStore'
import {
  useCreateMotoboy,
  useDeleteMotoboy,
  useMotoboys,
  useUpdateMotoboy,
} from '../hooks/useMotoboys'
import type { Motoboy } from '../services/motoboys.service'

import { PasswordInput } from '@/shared/components/PasswordInput'
import { formatBrPhone, onlyDigits } from '@/shared/lib/masks'

const PUBLIC_ROOT_DOMAIN =
  (import.meta.env.VITE_PUBLIC_ROOT_DOMAIN as string | undefined) || 'menupanda.com.br'

type EntregadorToast = { message: string; type: 'success' | 'error' } | null

function EntregadorToastView({
  toast,
  onClose,
}: {
  toast: EntregadorToast
  onClose: () => void
}) {
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

// ─── Telefone BR com DDD + 9 ───────────────────────────────────────────────────
// Backend grava com DDI `55`. No formulário, o usuário só informa DDD + número
// (10 ou 11 dígitos). O `55` é concatenado no submit.

function splitStoredPhone(stored: string | null | undefined): {
  ddd: string
  number: string
} {
  if (!stored) return { ddd: '', number: '' }
  let digits = onlyDigits(stored)
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2)
  }
  if (digits.length !== 10 && digits.length !== 11) return { ddd: '', number: '' }
  return { ddd: digits.slice(0, 2), number: digits.slice(2) }
}

function maskDdd(value: string): string {
  return onlyDigits(value).slice(0, 2)
}

/** Máscara do número local: `XXXXX-XXXX` (9 dígitos) ou `XXXX-XXXX` (8 dígitos). */
function maskLocalPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 9)
  if (digits.length <= 4) return digits
  if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

/**
 * Retorna o valor para gravar no backend (com `55` prefixado) ou string vazia
 * se o usuário deixou em branco. Retorna `null` se não passar validação
 * mínima (DDD+8 dígitos), pra UI bloquear.
 */
function buildStoredPhone(ddd: string, local: string): string | null {
  const d = onlyDigits(ddd)
  const l = onlyDigits(local)
  if (!d && !l) return ''
  if (d.length !== 2) return null
  if (l.length !== 8 && l.length !== 9) return null
  return `55${d}${l}`
}

function PhoneInputs({
  ddd,
  local,
  onDddChange,
  onLocalChange,
}: {
  ddd: string
  local: string
  onDddChange: (v: string) => void
  onLocalChange: (v: string) => void
}) {
  return (
    <div className="flex items-stretch gap-2">
      <span className="inline-flex items-center px-3 rounded-md border border-gray-300 bg-gray-50 text-sm text-gray-500">
        +55
      </span>
      <input
        type="tel"
        inputMode="numeric"
        value={ddd}
        onChange={(e) => onDddChange(maskDdd(e.target.value))}
        placeholder="11"
        aria-label="DDD"
        className="w-16 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
      />
      <input
        type="tel"
        inputMode="numeric"
        value={maskLocalPhone(local)}
        onChange={(e) => onLocalChange(onlyDigits(e.target.value))}
        placeholder="99999-9999"
        aria-label="Telefone"
        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function EditEntregadorModal({
  motoboy,
  onClose,
  onToast,
}: {
  motoboy: Motoboy
  onClose: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}) {
  const updateMutation = useUpdateMotoboy()
  const initial = splitStoredPhone(motoboy.whatsapp)
  const [name, setName] = useState(motoboy.name)
  const [ddd, setDdd] = useState(initial.ddd)
  const [phoneLocal, setPhoneLocal] = useState(initial.number)
  const [email, setEmail] = useState(motoboy.email ?? '')
  const [password, setPassword] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const stored = buildStoredPhone(ddd, phoneLocal)
    if (stored === null) {
      onToast('WhatsApp inválido. Informe DDD (2) + número (8 ou 9 dígitos).', 'error')
      return
    }
    const dto = {
      name: name.trim(),
      whatsapp: stored ? stored : null,
      email: email.trim() ? email.trim() : null,
      ...(password ? { password } : {}),
    }
    updateMutation.mutate(
      { id: motoboy.id, dto },
      {
        onSuccess: () => {
          onToast('Entregador atualizado!', 'success')
          onClose()
        },
        onError: (err) => onToast(extractApiError(err, 'Erro ao atualizar entregador.'), 'error'),
      }
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Editar Entregador</h3>
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
            <PhoneInputs
              ddd={ddd}
              local={phoneLocal}
              onDddChange={setDdd}
              onLocalChange={setPhoneLocal}
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
            <PasswordInput
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

function LoginLinkCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard pode falhar em http inseguro; fallback: selecionar e copiar manual
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Link de login do entregador</h2>
          <p className="text-xs text-gray-500 mb-3">
            Compartilhe com os entregadores para acessarem o painel deles.
          </p>
          <code className="block text-xs sm:text-sm text-blue-700 break-all bg-blue-50 rounded px-3 py-2 border border-blue-100">
            {url}
          </code>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            <ExternalLink size={14} />
            Abrir
          </a>
        </div>
      </div>
    </div>
  )
}

export function MotoboysPage() {
  const { data: motoboys, isLoading, isError } = useMotoboys()
  const { data: store } = useStore()
  const createMutation = useCreateMotoboy()
  const deleteMutation = useDeleteMotoboy()

  const [name, setName] = useState('')
  const [ddd, setDdd] = useState('')
  const [phoneLocal, setPhoneLocal] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [toast, setToast] = useState<EntregadorToast>(null)
  const [editing, setEditing] = useState<Motoboy | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
  }

  const loginUrl = useMemo(() => {
    if (!store) return ''
    const host = store.customDomain || (store.slug ? `${store.slug}.${PUBLIC_ROOT_DOMAIN}` : '')
    if (!host) return ''
    return `${window.location.protocol}//${host}/motoboy/login`
  }, [store])

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !password.trim()) return
    const stored = buildStoredPhone(ddd, phoneLocal)
    if (stored === null) {
      showToast('WhatsApp inválido. Informe DDD (2) + número (8 ou 9 dígitos).', 'error')
      return
    }
    createMutation.mutate(
      {
        name: name.trim(),
        ...(stored && { whatsapp: stored }),
        ...(email.trim() && { email: email.trim() }),
        password,
      },
      {
        onSuccess: () => {
          setName('')
          setDdd('')
          setPhoneLocal('')
          setEmail('')
          setPassword('')
          showToast('Entregador adicionado!', 'success')
        },
        onError: (err) => showToast(extractApiError(err, 'Erro ao adicionar entregador.'), 'error'),
      }
    )
  }

  function handleDelete(id: string, motoboyName: string) {
    if (!window.confirm(`Remover o entregador "${motoboyName}"?`)) return
    deleteMutation.mutate(id, {
      onSuccess: () => showToast('Entregador removido.', 'success'),
      onError: (err) => showToast(extractApiError(err, 'Erro ao remover entregador.'), 'error'),
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Entregadores</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <EntregadorToastView toast={toast} onClose={() => setToast(null)} />

        {loginUrl && <LoginLinkCard url={loginUrl} />}

        {/* Formulário inline */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Adicionar Entregador</h2>
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
                <PhoneInputs
                  ddd={ddd}
                  local={phoneLocal}
                  onDddChange={setDdd}
                  onLocalChange={setPhoneLocal}
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
                <PasswordInput
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
              {createMutation.isPending ? 'Adicionando...' : 'Adicionar Entregador'}
            </button>
          </form>
        </div>

        {/* Listagem */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Entregadores Cadastrados</h2>
          </div>

          {isLoading && (
            <p className="px-6 py-8 text-sm text-gray-500 text-center">Carregando...</p>
          )}

          {isError && (
            <p className="px-6 py-8 text-sm text-red-600 text-center">
              Erro ao carregar entregadores.
            </p>
          )}

          {motoboys && motoboys.length === 0 && (
            <p className="px-6 py-8 text-sm text-gray-500 text-center">
              Nenhum entregador cadastrado.
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
                    <td className="px-6 py-4 text-gray-600">
                      {formatBrPhone(motoboy.whatsapp) || '—'}
                    </td>
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
          <EditEntregadorModal
            motoboy={editing}
            onClose={() => setEditing(null)}
            onToast={showToast}
          />
        )}
      </main>
    </div>
  )
}
