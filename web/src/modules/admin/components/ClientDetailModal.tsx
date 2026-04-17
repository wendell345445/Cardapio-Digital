import { useState } from 'react'
import { Loader2, MapPin, Pencil, Phone, ShoppingBag, TrendingUp, User, X } from 'lucide-react'


import { useCustomerDetail } from '../hooks/useAnalytics'

import { CustomerEditModal } from './CustomerEditModal'

import { maskWhatsapp } from '@/shared/lib/masks'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  whatsapp: string
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientDetailModal({ whatsapp, onClose }: Props) {
  const { data: raw, isLoading, isError } = useCustomerDetail(whatsapp)
  const [editing, setEditing] = useState(false)

  // Defensive: arrays podem faltar se backend estiver em shape antigo.
  const data = raw
    ? {
        ...raw,
        addresses: raw.addresses ?? [],
        phones: raw.phones ?? [],
        hasProfile: raw.hasProfile ?? false,
      }
    : undefined

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {data?.name ?? 'Cliente'}
                </h2>
                <p className="text-base text-gray-700 font-medium flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-4 h-4 text-blue-500" />
                  {maskWhatsapp(whatsapp)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            )}

            {isError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                Erro ao carregar dados do cliente.
              </div>
            )}

            {data && (
              <>
                {/* Métricas */}
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    icon={<ShoppingBag className="w-4 h-4 text-gray-500" />}
                    label="Pedidos"
                    value={String(data.totalOrders)}
                  />
                  <MetricCard
                    icon={<TrendingUp className="w-4 h-4 text-gray-500" />}
                    label="Total gasto"
                    value={formatCurrency(data.totalSpent)}
                  />
                  <MetricCard
                    label="Ticket médio"
                    value={formatCurrency(data.averageTicket)}
                  />
                  <MetricCard label="Cliente desde" value={formatDate(data.firstOrderAt)} />
                </div>

                {/* Último pedido */}
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                    Último pedido
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatDate(data.lastOrderAt)}
                  </p>
                </div>

                {/* Telefones secundários */}
                {data.phones.filter((p) => !p.isPrimary).length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      Outros telefones
                    </h3>
                    <ul className="space-y-1.5">
                      {data.phones
                        .filter((p) => !p.isPrimary)
                        .map((p) => (
                          <li
                            key={p.id}
                            className="text-sm text-gray-700 flex items-center gap-2"
                          >
                            <span className="font-medium">{maskWhatsapp(p.phone)}</span>
                            {p.label && (
                              <span className="text-xs text-gray-400">• {p.label}</span>
                            )}
                          </li>
                        ))}
                    </ul>
                  </section>
                )}

                {/* Endereços */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {data.hasProfile ? 'Endereços' : 'Último endereço de entrega'}
                  </h3>
                  {data.addresses.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Nenhum endereço cadastrado.</p>
                  ) : (
                    <div className="space-y-3">
                      {data.addresses.map((a) => (
                        <div
                          key={a.id}
                          className={`rounded-lg border p-4 text-sm ${
                            a.isPrimary
                              ? 'border-blue-200 bg-blue-50/30'
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          {a.isPrimary && (
                            <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-blue-600 mb-1">
                              Principal
                            </span>
                          )}
                          <p className="text-gray-900 font-medium">
                            {a.street}
                            {a.number ? `, ${a.number}` : ''}
                          </p>
                          {a.complement && (
                            <p className="text-gray-700">{a.complement}</p>
                          )}
                          <p className="text-gray-700">{a.neighborhood}</p>
                          <p className="text-gray-700">
                            {a.city}
                            {a.state ? ` - ${a.state}` : ''}
                            {a.zipCode ? ` — CEP ${formatCep(a.zipCode)}` : ''}
                          </p>
                          {a.reference && (
                            <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                              Ref: {a.reference}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-white"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={!data}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5"
            >
              <Pencil className="w-4 h-4" />
              Editar cliente
            </button>
          </footer>
        </div>
      </div>

      {editing && data && (
        <CustomerEditModal
          customer={data}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      )}
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MetricCardProps {
  icon?: React.ReactNode
  label: string
  value: string
}

function MetricCard({ icon, label, value }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {icon}
        {label}
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function formatCep(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (d.length !== 8) return digits
  return `${d.slice(0, 5)}-${d.slice(5)}`
}
