import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '@/shared/lib/api'

interface ImportResult {
  success: number
  errors: { linha: number; erro: string }[]
  total: number
}

export function ImportProductsPage() {
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const handleDownloadTemplate = async () => {
    const response = await api.get('/admin/products/template', { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([response.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-produtos.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/admin/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao importar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Importar Produtos</h1>
        <button
          type="button"
          onClick={() => navigate('/admin/products')}
          className="text-sm text-gray-500 hover:underline"
        >
          ← Voltar
        </button>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">1. Baixar template</h2>
        <p className="text-sm text-gray-600">
          Baixe o template XLSX, preencha com seus produtos e faça o upload.
          <br />
          Variações e adicionais: use o formato <code className="bg-gray-100 px-1">Nome:Preco</code> separados por vírgula.
        </p>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-sm"
        >
          Baixar template .xlsx
        </button>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">2. Fazer upload da planilha</h2>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={handleImport}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {loading ? 'Importando...' : 'Selecionar planilha'}
        </button>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {result && (
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Resultado da importação</h2>
          <div className="flex gap-4 text-sm">
            <span className="text-green-600 font-medium">✓ {result.success} importados</span>
            <span className="text-red-500 font-medium">✗ {result.errors.length} erros</span>
            <span className="text-gray-500">Total: {result.total} linhas</span>
          </div>

          {result.errors.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-red-600">Erros por linha:</h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {result.errors.map((e) => (
                  <div key={e.linha} className="text-sm bg-red-50 px-3 py-1 rounded">
                    <span className="font-medium">Linha {e.linha}:</span> {e.erro}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.success > 0 && (
            <button
              type="button"
              onClick={() => navigate('/admin/products')}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              Ver produtos importados
            </button>
          )}
        </div>
      )}
    </div>
  )
}
