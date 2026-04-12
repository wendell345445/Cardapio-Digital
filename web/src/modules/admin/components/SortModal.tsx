import { useState } from 'react'
import { ArrowDownAZ, ArrowUpAZ, X } from 'lucide-react'

export type SortDirection = 'asc' | 'desc'

interface SortModalProps {
  open: boolean
  title: string
  onClose: () => void
  onApply: (direction: SortDirection) => Promise<void>
}

export function SortModal({ open, title, onClose, onApply }: SortModalProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handle(direction: SortDirection) {
    setError(null)
    setSaving(true)
    try {
      await onApply(direction)
      onClose()
    } catch (e) {
      const message =
        (e as { response?: { data?: { error?: string } }; message?: string }).response?.data
          ?.error ??
        (e as Error).message ??
        'Erro ao aplicar ordenação.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="p-4 space-y-2">
          <button
            type="button"
            onClick={() => handle('asc')}
            disabled={saving}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-md border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <ArrowDownAZ className="w-5 h-5 text-gray-600" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-900">Ordem crescente</p>
              <p className="text-xs text-gray-500">A → Z</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handle('desc')}
            disabled={saving}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-md border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <ArrowUpAZ className="w-5 h-5 text-gray-600" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-900">Ordem decrescente</p>
              <p className="text-xs text-gray-500">Z → A</p>
            </div>
          </button>
        </div>

        {error && (
          <p className="px-5 py-2 text-xs text-red-600 border-t border-red-100 bg-red-50">
            {error}
          </p>
        )}

        {saving && (
          <p className="px-5 py-3 text-xs text-gray-500 text-center border-t border-gray-100">
            Aplicando ordenação...
          </p>
        )}
      </div>
    </div>
  )
}
