import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { isAxiosError } from 'axios'

import { useCartStore } from '../store/useCartStore'
import { markTableModeActive } from '../hooks/useTableMode'

import { MenuPage } from './MenuPage'

import { createPublicApi } from '@/shared/lib/publicApi'

const api = createPublicApi()

interface OpenSessionResponse {
  data: { token: string; tableNumber: number; status: 'OPEN'; isNew: boolean }
}

interface SessionStatusResponse {
  data: { tableNumber: number; status: 'OPEN' }
}

interface TableByTokenResponse {
  data: { tableNumber: number }
}

// Hash de 16 chars hex — gerado pelo backend em randomBytes(8).toString('hex').
// Validar no front evita bater no backend pra rotas obviamente inválidas (ex:
// QR antigo numérico /mesa/2).
const ACCESS_TOKEN_RE = /^[a-f0-9]{16}$/i

export function TableEntryPage() {
  const { accessToken } = useParams<{ accessToken: string }>()
  const setTableSession = useCartStore((s) => s.setTableSession)
  const clearTableSession = useCartStore((s) => s.clearTableSession)
  const existingToken = useCartStore((s) => s.tableSessionToken)
  const existingTableNumber = useCartStore((s) => s.tableNumber)

  const validToken = accessToken && ACCESS_TOKEN_RE.test(accessToken)

  const [tableNumber, setTableNumber] = useState<number | null>(null)
  // sessionReady = sessão validada/aberta pra essa mesa nesta aba — passa a
  // renderizar MenuPage in-place (URL continua /mesa/:token, sem redirect).
  const [sessionReady, setSessionReady] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Resolve hash → tableNumber. Se já temos sessão OPEN salva pra essa mesma
  // mesa, entra direto sem perguntar nome.
  useEffect(() => {
    if (!validToken || !accessToken) {
      setChecking(false)
      return
    }
    let cancelled = false
    api
      .get<TableByTokenResponse>(`/menu/table-by-token/${accessToken}`)
      .then(({ data }) => {
        if (cancelled) return
        const number = data.data.tableNumber
        setTableNumber(number)
        // Sessão salva pra ESSA mesa? valida e entra.
        if (existingToken && existingTableNumber === number) {
          api
            .get<SessionStatusResponse>(`/menu/table-session/${existingToken}`)
            .then(() => {
              if (cancelled) return
              markTableModeActive()
              setSessionReady(true)
              setChecking(false)
            })
            .catch(() => {
              if (cancelled) return
              clearTableSession()
              setChecking(false)
            })
          return
        }
        setChecking(false)
      })
      .catch(() => {
        if (!cancelled) setChecking(false)
      })
    return () => { cancelled = true }
  }, [validToken, accessToken, existingToken, existingTableNumber, clearTableSession])

  async function handleSubmit(deviceName: string | null) {
    if (!validToken || !accessToken) return
    setSubmitting(true)
    setError(null)
    try {
      const { data } = await api.post<OpenSessionResponse>('/menu/table-session', {
        accessToken,
        ...(deviceName ? { deviceName } : {}),
      })
      setTableSession({
        tableNumber: data.data.tableNumber,
        token: data.data.token,
        deviceName,
      })
      markTableModeActive()
      setSessionReady(true)
    } catch (err) {
      const message = isAxiosError(err)
        ? err.response?.data?.error ?? 'Não foi possível abrir a mesa'
        : 'Não foi possível abrir a mesa'
      setError(message)
      setSubmitting(false)
    }
  }

  // Sessão validada — renderiza o cardápio in-place. URL permanece /mesa/:token.
  if (sessionReady) {
    return <MenuPage />
  }

  // QR antigo (numérico) ou hash mal-formado.
  if (!validToken) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">😕</p>
          <h1 className="text-xl font-bold text-gray-800">QR code inválido</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Este QR foi atualizado. Peça ao garçom o código novo da mesa.
          </p>
        </div>
      </div>
    )
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Backend não achou a mesa (hash válido mas não existe ou é de outra loja).
  if (!tableNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">😕</p>
          <h1 className="text-xl font-bold text-gray-800">Mesa não encontrada</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Verifique o QR code ou peça ajuda ao garçom.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-6 space-y-5">
        <div className="text-center">
          <p className="text-sm text-gray-500">Bem-vindo à</p>
          <h1 className="text-2xl font-bold text-gray-900">Mesa {tableNumber}</h1>
        </div>

        <div>
          <label htmlFor="device-name" className="block text-sm font-semibold text-gray-700 mb-1">
            Como devemos te chamar?
          </label>
          <input
            id="device-name"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Seu primeiro nome"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={submitting}
          />
          <p className="text-xs text-gray-500 mt-1">
            Vai aparecer pra cozinha junto com seu pedido.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => handleSubmit(name.trim() || null)}
          disabled={submitting || !name.trim()}
          className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm"
        >
          {submitting ? 'Abrindo mesa...' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
