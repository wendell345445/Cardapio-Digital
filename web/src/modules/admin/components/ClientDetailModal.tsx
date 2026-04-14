import { Loader2, MapPin, Phone, ShoppingBag, TrendingUp, User, X } from 'lucide-react'

import { useClientDetail } from '../hooks/useAnalytics'

interface ClientDetailModalProps {
  whatsapp: string | null
  onClose: () => void
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatWhatsapp(w: string) {
  const digits = w.replace(/\D/g, '')
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  return w
}

function formatAddress(addr: Record<string, unknown> | null | undefined) {
  if (!addr) return null
  const street = (addr.street as string) ?? ''
  const number = (addr.number as string) ?? ''
  const complement = (addr.complement as string) ?? ''
  const neighborhood = (addr.neighborhood as string) ?? ''
  const city = (addr.city as string) ?? ''
  const state = (addr.state as string) ?? ''
  const zipCode = (addr.zipCode as string) ?? ''
  const reference = (addr.reference as string) ?? ''

  const line1 = [street, number].filter(Boolean).join(', ')
  const line2 = complement
  const line3 = neighborhood
  const cityState = [city, state].filter(Boolean).join(' - ')
  const line4 = [cityState, zipCode && `CEP ${zipCode}`].filter(Boolean).join(' — ')

  return {
    lines: [line1, line2, line3, line4].filter(Boolean),
    reference,
  }
}

export function ClientDetailModal({ whatsapp, onClose }: ClientDetailModalProps) {
  const { data, isLoading, isError } = useClientDetail(whatsapp)

  if (!whatsapp) return null

  const address = formatAddress(data?.lastAddress as Record<string, unknown> | null | undefined)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {data?.name ?? (isLoading ? 'Carregando...' : 'Sem nome')}
              </h2>
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5" />
                {formatWhatsapp(whatsapp)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2 text-sm">Carregando dados...</span>
            </div>
          )}

          {isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              Erro ao carregar detalhes do cliente.
            </div>
          )}

          {data && (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    PEDIDOS
                  </div>
                  <p className="text-xl font-bold text-gray-900">{data.totalOrders}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    TOTAL GASTO
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(data.totalSpent)}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">TICKET MÉDIO</div>
                  <p className="text-lg font-semibold text-gray-700">
                    {formatCurrency(data.averageTicket)}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">CLIENTE DESDE</div>
                  <p className="text-lg font-semibold text-gray-700">
                    {formatDate(data.firstOrderAt)}
                  </p>
                </div>
              </div>

              {/* Último pedido */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="text-xs text-blue-700 font-medium mb-1">ÚLTIMO PEDIDO</div>
                <p className="text-sm font-semibold text-gray-900">
                  {formatDate(data.lastOrderAt)}
                </p>
              </div>

              {/* Endereço */}
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  <MapPin className="w-3.5 h-3.5" />
                  Último Endereço de Entrega
                </div>
                {address ? (
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 space-y-0.5">
                    {address.lines.length > 0 ? (
                      address.lines.map((line, idx) => (
                        <p key={idx} className={idx === 0 ? 'font-medium' : ''}>
                          {line}
                        </p>
                      ))
                    ) : (
                      <p className="font-medium">Sem dados de endereço</p>
                    )}
                    {address.reference && (
                      <p className="text-xs text-gray-500 pt-1 mt-1 border-t border-gray-200">
                        Ref: {address.reference}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    Nenhum endereço registrado (cliente só pediu retirada/consumo local)
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
