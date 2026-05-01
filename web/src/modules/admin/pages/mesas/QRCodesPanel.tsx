import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Download, FileDown, Save } from 'lucide-react'

import { useSetTablesCount, useTables } from '../../hooks/useTables'
import {
  downloadAllQRCodesPDF,
  downloadQRCodePDF,
  type TableWithComanda,
} from '../../services/tables.service'

import { toast } from '@/shared/lib/toast'

export function QRCodesPanel() {
  const { data: tables, isLoading } = useTables()
  const setCountMutation = useSetTablesCount()

  const [count, setCount] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)

  // Inicializa o input com o total atual quando carrega.
  useEffect(() => {
    if (tables && count === '') setCount(String(tables.length))
  }, [tables, count])

  function handleSaveCount(e: React.FormEvent) {
    e.preventDefault()
    const n = parseInt(count, 10)
    if (Number.isNaN(n) || n < 0) {
      toast.error('Informe um número válido')
      return
    }
    setCountMutation.mutate(n, {
      onSuccess: () => toast.success(`Total de mesas atualizado para ${n}`),
      onError: (err) => {
        const msg = isAxiosError(err)
          ? err.response?.data?.error ?? 'Erro ao atualizar total'
          : 'Erro ao atualizar total'
        toast.error(msg)
      },
    })
  }

  async function handleDownloadOne(table: TableWithComanda) {
    if (downloadingId) return
    setDownloadingId(table.id)
    try {
      await downloadQRCodePDF(table.id, table.number)
    } catch {
      toast.error('Erro ao gerar PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleDownloadAll() {
    if (downloadingAll) return
    setDownloadingAll(true)
    try {
      await downloadAllQRCodesPDF()
    } catch (err) {
      const msg = isAxiosError(err)
        ? err.response?.data?.error ?? 'Erro ao gerar PDF'
        : 'Erro ao gerar PDF'
      toast.error(msg)
    } finally {
      setDownloadingAll(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Configura quantidade */}
      <form onSubmit={handleSaveCount} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Quantas mesas você atende?</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Sistema cria mesas 1..N e remove mesas com número maior (apenas livres).
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              Total
            </label>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              min={0}
              max={200}
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <button
            type="submit"
            disabled={setCountMutation.isPending}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {setCountMutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>

      {/* Imprimir todos */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <button
          type="button"
          onClick={handleDownloadAll}
          disabled={downloadingAll || !tables || tables.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-lg transition-colors"
        >
          <FileDown className="w-4 h-4" />
          {downloadingAll ? 'Gerando PDF...' : 'Imprimir todos os QR Codes (PDF único)'}
        </button>
      </div>

      {/* Lista por mesa */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Mesas cadastradas</h2>
        {isLoading && <p className="text-sm text-gray-500 text-center py-4">Carregando...</p>}
        {!isLoading && (tables ?? []).length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma mesa cadastrada.</p>
        )}
        {(tables ?? []).length > 0 && (
          <ul className="divide-y divide-gray-100">
            {(tables ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium text-gray-800">Mesa {t.number}</span>
                <button
                  type="button"
                  onClick={() => handleDownloadOne(t)}
                  disabled={downloadingId === t.id}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-md disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingId === t.id ? 'Gerando...' : 'Imprimir QR'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
