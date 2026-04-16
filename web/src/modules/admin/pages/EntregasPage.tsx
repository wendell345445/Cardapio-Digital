import { useState } from 'react'

import { useMotoboys, useSetMotoboyAvailability } from '../hooks/useMotoboys'
import { useStore, useUpdatePaymentSettings } from '../hooks/useStore'

import { BairrosPage } from './BairrosPage'

// ─── A-032 / Entregas: painel operacional da entrega ─────────────────────────
// Unifica:
//   - Toggle geral "Aceitando entregas" (Store.allowDelivery)
//   - Disponibilidade diária dos motoboys (User.availableAt — reset lazy à meia-noite)
//   - Taxas por bairro (reaproveita BairrosPage)

type Tab = 'status' | 'motoboys' | 'bairros'

const TABS: { id: Tab; label: string }[] = [
  { id: 'status', label: 'Status' },
  { id: 'motoboys', label: 'Motoboys' },
  { id: 'bairros', label: 'Bairros' },
]

function TabStatus() {
  const { data: store, isLoading } = useStore()
  const updateMutation = useUpdatePaymentSettings()

  if (isLoading) return <p className="text-sm text-gray-500 py-6 text-center">Carregando...</p>
  if (!store) return null

  const allowDelivery = store.allowDelivery !== false
  const allowPickup = !!store.allowPickup

  function toggleDelivery() {
    updateMutation.mutate(
      { allowDelivery: !allowDelivery },
      { onError: () => alert('Erro ao atualizar status de entrega.') }
    )
  }

  function togglePickup() {
    updateMutation.mutate(
      { allowPickup: !allowPickup },
      { onError: () => alert('Erro ao atualizar status de retirada.') }
    )
  }

  const neitherAccepted = !allowDelivery && !allowPickup

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Aceitando pedidos</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Controle rápido para pausar ou reabrir a entrada de pedidos por tipo.
          </p>
        </div>

        <ToggleRow
          label="🛵 Entrega"
          description="Exibe a opção de entrega no checkout público."
          checked={allowDelivery}
          disabled={updateMutation.isPending}
          onChange={toggleDelivery}
        />

        <ToggleRow
          label="🏪 Retirada no local"
          description="Cliente retira o pedido diretamente na loja."
          checked={allowPickup}
          disabled={updateMutation.isPending}
          onChange={togglePickup}
        />

        {neitherAccepted && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <span>⚠️</span>
            <p>
              Com entrega e retirada desativadas, clientes não conseguem finalizar pedidos.
              Ative ao menos uma opção.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 ${
          checked ? 'bg-green-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

function TabMotoboys() {
  const { data: motoboys, isLoading } = useMotoboys()
  const availabilityMutation = useSetMotoboyAvailability()

  if (isLoading) return <p className="text-sm text-gray-500 py-6 text-center">Carregando...</p>

  const list = motoboys ?? []

  if (list.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">
          Nenhum motoboy cadastrado. Cadastre em{' '}
          <a href="/admin/configuracoes" className="text-red-500 hover:underline">
            Configurações &gt; Motoboys
          </a>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Disponibilidade do dia</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Ative cada motoboy que veio trabalhar hoje. A disponibilidade é resetada automaticamente à meia-noite.
          </p>
        </div>
        <ul className="divide-y divide-gray-50">
          {list.map((m) => {
            const available = !!m.availableToday
            return (
              <li key={m.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{m.name}</p>
                  <p className="text-xs text-gray-500">
                    {m.whatsapp ?? m.email ?? '—'}
                    {m.lastAssignedAt && (
                      <> · Última atribuição: {new Date(m.lastAssignedAt).toLocaleString('pt-BR')}</>
                    )}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    available
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {available ? 'Disponível' : 'Offline'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={available}
                  onClick={() =>
                    availabilityMutation.mutate({ id: m.id, available: !available })
                  }
                  disabled={availabilityMutation.isPending}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                    available ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      available ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export function EntregasPage() {
  const [tab, setTab] = useState<Tab>('status')

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Entregas</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Status operacional, disponibilidade dos motoboys e taxas por bairro.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-red-500 text-red-500'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'status' && <TabStatus />}
      {tab === 'motoboys' && <TabMotoboys />}
      {tab === 'bairros' && <BairrosPage />}
    </div>
  )
}
