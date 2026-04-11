import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'

import {
  useStore,
  useUpdateStore,
  useCancelStore,
  useUpdateStorePlan,
  useEndTrialNow,
} from '../hooks/useOwnerStores'
import { AuditLogTable } from '../components/AuditLogTable'
import { StoreAdminsTab } from '../components/StoreAdminsTab'
import type { StoreStatus, StorePlan } from '../services/owner.service'

type ToastState = { message: string; type: 'success' | 'error' } | null

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null
  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-sm font-medium ${
        toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      }`}
    >
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-1 opacity-80 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  )
}

type Tab = 'details' | 'audit-logs' | 'admins'

const STATUS_LABELS: Record<StoreStatus, string> = {
  TRIAL: 'Trial',
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  CANCELLED: 'Cancelada',
}

export function StoreDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('details')
  const [showPlanSelector, setShowPlanSelector] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<StorePlan>('PROFESSIONAL')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const { data: store, isLoading, isError } = useStore(id!)
  const updateStore = useUpdateStore(id!)
  const cancelStore = useCancelStore()
  const updatePlan = useUpdateStorePlan(id!)
  const endTrialNow = useEndTrialNow(id!)

  const { register, handleSubmit } = useForm<{ name: string; description: string }>()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Carregando loja...</p>
      </div>
    )
  }

  if (isError || !store) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600 text-sm">Loja não encontrada.</p>
      </div>
    )
  }

  function handleEditSubmit(data: { name: string; description: string }) {
    updateStore.mutate(data, {
      onSuccess: () => setToast({ message: 'Loja atualizada com sucesso!', type: 'success' }),
      onError: () => setToast({ message: 'Erro ao atualizar loja.', type: 'error' }),
    })
  }

  function handleCancelStore() {
    cancelStore.mutate(id!, {
      onSuccess: () => {
        setToast({ message: 'Loja cancelada.', type: 'success' })
        navigate('/owner/dashboard')
      },
      onError: () => setToast({ message: 'Erro ao cancelar loja.', type: 'error' }),
    })
  }

  function handlePlanChange() {
    updatePlan.mutate(selectedPlan, {
      onSuccess: () => {
        setShowPlanSelector(false)
        setToast({ message: 'Plano alterado com sucesso!', type: 'success' })
      },
      onError: () => setToast({ message: 'Erro ao alterar plano.', type: 'error' }),
    })
  }

  function handleEndTrialNow() {
    endTrialNow.mutate(undefined, {
      onSuccess: () =>
        setToast({
          message: 'Trial encerrado no Stripe. Sweep enfileirado — status atualiza em ~2s.',
          type: 'success',
        }),
      onError: () => setToast({ message: 'Erro ao encerrar trial.', type: 'error' }),
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link to="/owner/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{store.name}</h1>
        <span className="text-sm text-gray-400 font-mono">{store.slug}</span>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex gap-6">
          {(['details', 'admins', 'audit-logs'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'details' ? 'Detalhes' : t === 'admins' ? 'Admins' : 'Audit Logs'}
            </button>
          ))}
        </nav>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {tab === 'details' && (
          <>
            {/* Info cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500">Status</p>
                <p className="font-semibold text-gray-900 mt-1">{STATUS_LABELS[store.status]}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500">Plano</p>
                <p className="font-semibold text-gray-900 mt-1">{store.plan}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500">WhatsApp</p>
                <p className="font-semibold text-gray-900 mt-1 font-mono text-sm">{store.phone}</p>
                <span
                  className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    (store as any).whatsappMode === 'WHATSAPP_AI'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {(store as any).whatsappMode === 'WHATSAPP_AI' ? 'WhatsApp + IA' : 'WhatsApp'}
                </span>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500">Criada em</p>
                <p className="font-semibold text-gray-900 mt-1">
                  {new Date(store.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            {/* Admin info */}
            {store.users[0] && (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Admin da loja</h2>
                <p className="text-sm text-gray-600">
                  {store.users[0].name} — {store.users[0].email}
                </p>
              </div>
            )}

            {/* Edit form */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Editar loja</h2>
              <form onSubmit={handleSubmit(handleEditSubmit)} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nome</label>
                  <input
                    {...register('name')}
                    defaultValue={store.name}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Descrição</label>
                  <textarea
                    {...register('description')}
                    defaultValue={store.description ?? ''}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={updateStore.isPending}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateStore.isPending ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </form>
            </div>

            {/* Alterar plano */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700">Plano atual: {store.plan}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {store.plan === 'PROFESSIONAL' ? 'R$ 99/mês' : 'R$ 149/mês'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedPlan(store.plan === 'PROFESSIONAL' ? 'PREMIUM' : 'PROFESSIONAL')
                    setShowPlanSelector(true)
                  }}
                  className="text-sm text-blue-600 hover:underline font-medium"
                >
                  Alterar Plano
                </button>
              </div>

              {showPlanSelector && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                  <p className="text-sm font-medium text-gray-700">Selecione o novo plano:</p>
                  <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value as StorePlan)}
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PROFESSIONAL">Profissional — R$ 99/mês</option>
                    <option value="PREMIUM">Premium — R$ 149/mês</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePlanChange}
                      disabled={updatePlan.isPending || selectedPlan === store.plan}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {updatePlan.isPending ? 'Alterando...' : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => setShowPlanSelector(false)}
                      className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Encerrar trial agora — ação operacional do Owner (disponível em todos os ambientes) */}
            {store.status === 'TRIAL' && (
              <div className="bg-amber-50 rounded-lg border-2 border-dashed border-amber-400 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block px-2 py-0.5 bg-amber-600 text-white text-[10px] font-bold rounded uppercase tracking-wide">
                    Owner
                  </span>
                  <h2 className="text-sm font-semibold text-amber-900">
                    Encerrar trial agora
                  </h2>
                </div>
                <p className="text-xs text-amber-800 mb-3 leading-relaxed">
                  Encerra o trial no Stripe (<code className="px-1 bg-amber-100 rounded">trial_end: 'now'</code>),
                  marca a loja pra suspensão e enfileira o sweep imediato — a loja
                  passa por <code className="px-1 bg-amber-100 rounded">SUSPENDED</code> e o admin
                  recebe o email <code className="px-1 bg-amber-100 rounded">trial-suspended</code>{' '}
                  em poucos segundos. Use pra validar o ciclo ou pra agir sobre uma loja específica.
                </p>
                <button
                  onClick={handleEndTrialNow}
                  disabled={endTrialNow.isPending}
                  className="text-sm bg-amber-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  {endTrialNow.isPending ? 'Encerrando...' : 'Encerrar trial agora'}
                </button>
              </div>
            )}

            {/* Zona de perigo */}
            {store.status !== 'CANCELLED' && (
              <div className="bg-white rounded-lg border border-red-200 p-5">
                <h2 className="text-sm font-semibold text-red-700 mb-2">Zona de perigo</h2>
                <p className="text-xs text-gray-500 mb-4">
                  Cancelar a loja muda o status para CANCELLED. Os dados não são excluídos.
                </p>
                {!confirmCancel ? (
                  <button
                    onClick={() => setConfirmCancel(true)}
                    className="text-sm text-red-600 border border-red-300 px-4 py-2 rounded-lg hover:bg-red-50"
                  >
                    Cancelar loja
                  </button>
                ) : (
                  <div className="flex gap-3 items-center">
                    <p className="text-sm text-red-600 font-medium">Tem certeza?</p>
                    <button
                      onClick={handleCancelStore}
                      disabled={cancelStore.isPending}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {cancelStore.isPending ? 'Cancelando...' : 'Sim, cancelar'}
                    </button>
                    <button
                      onClick={() => setConfirmCancel(false)}
                      className="text-sm text-gray-600 hover:underline"
                    >
                      Voltar
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'admins' && <StoreAdminsTab storeId={id!} />}

        {tab === 'audit-logs' && <AuditLogTable storeId={id!} />}
      </main>
    </div>
  )
}
