import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  ShoppingBag,
  TrendingUp,
  Receipt,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  Bike,
} from 'lucide-react'

import { useAdminDashboard } from '../hooks/useAdminDashboard'
import { useStore } from '../hooks/useStore'

const PUBLIC_ROOT_DOMAIN = (import.meta.env.VITE_PUBLIC_ROOT_DOMAIN as string | undefined) || 'supercardapio.com.br'

function fmt(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function countByStatus(orders: Array<{ status: string }>, ...statuses: string[]) {
  return orders.filter((o) => statuses.includes(o.status)).length
}

export function AdminDashboardPage() {
  const { sales, topProducts, recentOrders, liveOrders } = useAdminDashboard()
  const { data: store } = useStore()

  const allLive = liveOrders.data?.orders ?? []
  const allRecent = recentOrders.data?.orders ?? []

  const pending = countByStatus(allLive, 'PENDING', 'WAITING_PAYMENT_PROOF', 'WAITING_CONFIRMATION')
  const confirmed = countByStatus(allLive, 'CONFIRMED')
  const preparing = countByStatus(allLive, 'PREPARING')
  const ready = countByStatus(allLive, 'READY', 'DISPATCHED')

  const chartData = sales.data?.series?.map((s) => ({
    name: s.label,
    Pedidos: s.orders,
    'Receita (R$)': s.revenue,
  })) ?? []

  return (
    <div className="p-6 space-y-6">
      {/* Hero */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">
              Dashboard
            </p>
            <h1 className="text-2xl font-bold text-gray-900">
              Visão completa da operação em{' '}
              <span className="text-red-500">tempo real</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Acompanhe receita, fluxo de pedidos e saúde da operação em um painel mais
              tecnológico, visual e preparado para decisões rápidas.
            </p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                RESTAURANTE: {store?.name ?? '...'}
              </span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                CAIXA: {store?.manualOpen === true ? 'Aberto' : store?.manualOpen === false ? 'Fechado' : 'Automático'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/admin/pedidos"
              className="text-sm border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Ver pedidos →
            </Link>
            <a
              href={store?.slug ? `${window.location.protocol}//${store.slug}.${PUBLIC_ROOT_DOMAIN}` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              Abrir cardápio →
            </a>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Pedidos monitorados
            </p>
            <ShoppingBag className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {sales.data?.totalOrders ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">Últimos 7 dias carregados</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Receita acumulada
            </p>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {fmt(sales.data?.totalRevenue ?? 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Pedidos concluídos no período</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Ticket médio
            </p>
            <Receipt className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {fmt(sales.data?.averageTicket ?? 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Valor médio por pedido válido</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Produtos em destaque
            </p>
            <Star className="w-4 h-4 text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {topProducts.data?.length ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">Mais vendidos no cardápio</p>
        </div>
      </div>

      {/* Gráfico semanal */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Ritmo semanal
          </p>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          Pedidos e receita dos últimos 7 dias
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Cada dia possui 2 barras: <span className="text-red-400 font-medium">esquerda = pedidos</span>{' '}
          · <span className="text-blue-400 font-medium">direita = receita</span>
        </p>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value, name) => {
                  const v = Number(value)
                  return name === 'Receita (R$)' ? [fmt(v), name] : [v, name]
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="Pedidos" fill="#EF4444" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="Receita (R$)" fill="#93C5FD" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
            Sem dados para o período
          </div>
        )}
      </div>

      {/* Resumo operacional + Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Resumo operacional */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Resumo operacional
          </p>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Centro de comando da operação
          </h2>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-xs text-gray-400">FILA ATIVA</p>
              <p className="text-2xl font-bold text-gray-900">{allLive.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">ÚLTIMA HORA</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">TICKET MÉDIO</p>
              <p className="text-lg font-bold text-gray-900">
                {fmt(sales.data?.averageTicket ?? 0)}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-600">Saúde da operação</span>
              </div>
              <span className="text-sm font-bold text-green-600">100%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-gray-600">Em produção</span>
              </div>
              <span className="text-sm font-semibold">{preparing}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600">Prontos / saída</span>
              </div>
              <span className="text-sm font-semibold">{ready}</span>
            </div>
          </div>
        </div>

        {/* Ranking de produtos */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Ranking de produtos
              </p>
              <h2 className="text-lg font-bold text-gray-900">Mais vendidos no período</h2>
            </div>
            <Star className="w-5 h-5 text-yellow-400" />
          </div>

          <div className="space-y-3">
            {(topProducts.data ?? []).slice(0, 4).map((p, i) => (
              <div key={p.productId} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.productName}</p>
                  <p className="text-xs text-gray-400">
                    {p.quantity} vendidos · Receita {fmt(p.revenue)}
                  </p>
                </div>
              </div>
            ))}
            {(topProducts.data?.length ?? 0) === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                Sem dados de ranking para o período
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-600" />
            <p className="text-sm font-semibold text-yellow-700">Pendentes</p>
          </div>
          <p className="text-3xl font-bold text-yellow-700">{pending}</p>
          <p className="text-xs text-yellow-500 mt-1">Aguardando triagem</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-700">Confirmados</p>
          </div>
          <p className="text-3xl font-bold text-blue-700">{confirmed}</p>
          <p className="text-xs text-blue-400 mt-1">Aguardando produção</p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-orange-600" />
            <p className="text-sm font-semibold text-orange-700">Em preparo</p>
          </div>
          <p className="text-3xl font-bold text-orange-700">{preparing}</p>
          <p className="text-xs text-orange-400 mt-1">Em execução na cozinha</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Bike className="w-4 h-4 text-green-600" />
            <p className="text-sm font-semibold text-green-700">Prontos</p>
          </div>
          <p className="text-3xl font-bold text-green-700">{ready}</p>
          <p className="text-xs text-green-400 mt-1">Aguardando saída</p>
        </div>
      </div>

      {/* Últimos pedidos */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Monitoramento
            </p>
            <h2 className="text-lg font-bold text-gray-900">Últimos pedidos</h2>
            <p className="text-xs text-gray-400">
              Visão recente da operação com os pedidos mais novos do restaurante.
            </p>
          </div>
          <Link
            to="/admin/pedidos"
            className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Ver todos os pedidos
          </Link>
        </div>

        <div className="space-y-2">
          {allRecent.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Pedido #{order.number}
                </p>
                <p className="text-xs text-gray-400">
                  {order.clientName ?? 'Cliente'} · {order.type === 'DELIVERY' ? 'DELIVERY' : order.type === 'PICKUP' ? 'RETIRADA' : 'MESA'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-red-500">{fmt(order.total)}</p>
                <p className="text-xs text-gray-400">
                  {new Date(order.createdAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}

          {allRecent.length === 0 && (
            <div className="py-8 text-center">
              <XCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhum pedido recente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
