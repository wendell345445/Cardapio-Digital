import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

import { reauth } from '../services/auth.service'

interface ReauthModalProps {
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

export function ReauthModal({
  open,
  title = 'Confirmar ação',
  description = 'Por segurança, digite sua senha para confirmar esta ação.',
  confirmLabel = 'Confirmar',
  onCancel,
  onConfirm,
}: ReauthModalProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setPassword('')
      setError(null)
      setSubmitting(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  if (!open) return null

  async function handleConfirm() {
    if (!password) {
      setError('Digite sua senha.')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      await reauth(password)
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; message?: string } } })
        ?.response?.data
      const message = data?.error ?? data?.message ?? 'Senha incorreta. Tente novamente.'
      setError(message)
      setSubmitting(false)
      return
    }

    // Senha validou: fecha o modal ANTES de rodar onConfirm pra garantir que,
    // se o onConfirm falhar (ex: erro de validação no save), o modal não fica
    // preso aberto. Erros do onConfirm são responsabilidade do caller.
    onCancel()
    try {
      await onConfirm()
    } catch {
      // silencioso — caller cuida do erro (banner no form, toast, etc).
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm">
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Propositalmente SEM <form> pra o Chrome não oferecer "salvar senha".
            O prompt de salvar é disparado por submit de form com input type=password
            — sem form não há submit, e browsers não oferecem salvar. */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">{description}</p>

          <div>
            <label htmlFor="reauth-confirmation" className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              ref={inputRef}
              id="reauth-confirmation"
              name="reauth-confirmation"
              type="password"
              autoComplete="one-time-code"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={submitting}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50"
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Validando...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
