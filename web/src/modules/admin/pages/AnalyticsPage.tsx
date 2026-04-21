import { useState } from 'react'
import { BarChart2, CreditCard, ShoppingBag, TrendingUp, Users } from 'lucide-react'

import {
  usePaymentBreakdown,
  usePeakHours,
  useSales,
  useTopProducts,
} from '../hooks/useAnalytics'
import type { DateRange, PaymentBreakdownItem, Period } from '../services/analytics.service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className ?? ''}`} />
  )
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ElementType
  label: string
  value: string
  loading: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-32 mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        )}
      </div>
    </div>
  )
}

// ─── Sales Line Chart (div-based) ─────────────────────────────────────────────

function SalesChart({
  series,
  loading,
}: {
  series: Array<{ label: string; revenue: number }>
  loading: boolean
}) {
  if (loading) {
    return <Skeleton className="h-48 w-full" />
  }

  if (!series || series.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-gray-400">
        Sem dados para o período
      </div>
    )
  }

  const maxValue = Math.max(...series.map((s) => s.revenue), 1)

  return (
    <div className="relative h-48">
      {/* Y-axis guide lines */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
        {[100, 75, 50, 25, 0].map((pct) => (
          <div key={pct} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-14 text-right flex-shrink-0">
              {formatCurrency((maxValue * pct) / 100)}
            </span>
            <div className="flex-1 border-t border-dashed border-gray-100" />
          </div>
        ))}
      </div>

      {/* Bars */}
      <div className="absolute inset-0 flex items-end gap-1 pl-16 pr-2 pb-0 pt-2">
        {series.map((point, idx) => {
          const heightPct = (point.revenue / maxValue) * 100
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="relative w-full flex justify-center">
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  {formatCurrency(point.revenue)}
                </div>
              </div>
              <div
                className="w-full rounded-t-sm bg-blue-500 hover:bg-blue-600 transition-colors cursor-default"
                style={{ height: `${Math.max(heightPct, 1)}%` }}
              />
            </div>
          )
        })}
      </div>

      {/* X-axis labels */}
      <div className="absolute bottom-0 left-16 right-2 -mb-6 flex gap-1">
        {series.map((point, idx) => (
          <div key={idx} className="flex-1 text-center">
            <span className="text-xs text-gray-400 truncate block">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Top Products Chart ────────────────────────────────────────────────────────

function TopProductsChart({
  products,
  loading,
}: {
  products: Array<{ productName: string; quantity: number }>
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (!products || products.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">Sem dados para o período</p>
    )
  }

  const maxQty = Math.max(...products.map((p) => p.quantity), 1)

  return (
    <div className="space-y-3">
      {products.map((product, idx) => {
        const widthPct = (product.quantity / maxQty) * 100
        return (
          <div key={idx} className="flex items-center gap-3">
            <span className="w-5 text-xs font-bold text-gray-400 flex-shrink-0 text-right">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 truncate pr-2">
                  {product.productName}
                </span>
                <span className="text-sm font-bold text-gray-900 flex-shrink-0">
                  {product.quantity}x
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Peak Hours Grid ──────────────────────────────────────────────────────────

function PeakHoursGrid({
  hours,
  loading,
}: {
  hours: Array<{ hour: number; orders: number }>
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-12 gap-1">
        {Array.from({ length: 24 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded" />
        ))}
      </div>
    )
  }

  if (!hours || hours.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Sem dados disponíveis</p>
  }

  const maxOrders = Math.max(...hours.map((h) => h.orders), 1)

  // Build a map for quick lookup
  const byHour: Record<number, number> = {}
  for (const h of hours) byHour[h.hour] = h.orders

  function intensityClass(orders: number) {
    const ratio = orders / maxOrders
    if (ratio === 0) return 'bg-gray-100 text-gray-400'
    if (ratio < 0.25) return 'bg-blue-100 text-blue-700'
    if (ratio < 0.5) return 'bg-blue-300 text-blue-900'
    if (ratio < 0.75) return 'bg-blue-500 text-white'
    return 'bg-blue-700 text-white'
  }

  return (
    <div className="grid grid-cols-12 gap-1">
      {Array.from({ length: 24 }).map((_, hour) => {
        const orders = byHour[hour] ?? 0
        return (
          <div
            key={hour}
            title={`${String(hour).padStart(2, '0')}h — ${orders} pedidos`}
            className={`flex flex-col items-center justify-center rounded p-1 text-center cursor-default transition-colors ${intensityClass(orders)}`}
          >
            <span className="text-xs font-semibold leading-none">
              {String(hour).padStart(2, '0')}h
            </span>
            <span className="text-xs leading-none mt-0.5">{orders}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Payment Breakdown ────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão (online)',
  CASH_ON_DELIVERY: 'Dinheiro na entrega',
  CREDIT_ON_DELIVERY: 'Crédito na entrega',
  DEBIT_ON_DELIVERY: 'Débito na entrega',
  PIX_ON_DELIVERY: 'Pix na entrega',
}

function PaymentBreakdownChart({
  items,
  loading,
}: {
  items: PaymentBreakdownItem[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">Sem dados para o período</p>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.method} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 truncate pr-2">
                {PAYMENT_LABELS[item.method] ?? item.method}
              </span>
              <span className="text-sm font-bold text-gray-900 flex-shrink-0">
                {formatCurrency(item.revenue)}
                <span className="text-xs text-gray-500 ml-2 font-normal">
                  ({item.count} {item.count === 1 ? 'pedido' : 'pedidos'} · {item.percentage.toFixed(1)}%)
                </span>
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-purple-500 transition-all duration-500"
                style={{ width: `${Math.min(item.percentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── AnalyticsPage ────────────────────────────────────────────────────────────

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'range', label: 'Range' },
]

function todayISO(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('day')
  const today = todayISO()
  const [rangeFrom, setRangeFrom] = useState<string>(today)
  const [rangeTo, setRangeTo] = useState<string>(today)

  const rangeValid = rangeFrom && rangeTo && rangeFrom <= rangeTo
  const effectiveRange: DateRange | undefined =
    period === 'range' && rangeValid ? { from: rangeFrom, to: rangeTo } : undefined

  const { data: sales, isLoading: loadingSales } = useSales(period, effectiveRange)
  const { data: topProducts, isLoading: loadingProducts } = useTopProducts(
    period,
    10,
    effectiveRange
  )
  const { data: peakHours, isLoading: loadingPeakHours } = usePeakHours(
    period === 'range' ? 'range' : 'month',
    effectiveRange
  )
  const { data: paymentBreakdown, isLoading: loadingPayments } = usePaymentBreakdown(
    period,
    effectiveRange
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          </div>

          {/* Period Selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    period === p.value
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {period === 'range' && (
              <div className="flex items-center gap-2 text-sm">
                <label className="flex items-center gap-1.5">
                  <span className="text-gray-500">De</span>
                  <input
                    type="date"
                    value={rangeFrom}
                    max={rangeTo || today}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-gray-500">Até</span>
                  <input
                    type="date"
                    value={rangeTo}
                    min={rangeFrom}
                    max={today}
                    onChange={(e) => setRangeTo(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  />
                </label>
                {!rangeValid && (
                  <span className="text-xs text-red-500">
                    Data inicial deve ser &le; data final
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            icon={TrendingUp}
            label="Total Vendido"
            value={formatCurrency(sales?.totalRevenue ?? 0)}
            loading={loadingSales}
          />
          <SummaryCard
            icon={ShoppingBag}
            label="Nº Pedidos"
            value={String(sales?.totalOrders ?? 0)}
            loading={loadingSales}
          />
          <SummaryCard
            icon={Users}
            label="Ticket Médio"
            value={formatCurrency(sales?.averageTicket ?? 0)}
            loading={loadingSales}
          />
        </div>

        {/* Sales Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-6">
            Evolução de Vendas
          </h2>
          <SalesChart series={sales?.series ?? []} loading={loadingSales} />
          <div className="mt-8" />
        </div>

        {/* Top Products + Peak Hours */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Top 10 Produtos
            </h2>
            <TopProductsChart products={topProducts ?? []} loading={loadingProducts} />
          </div>

          {/* Peak Hours */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Horários de Pico
            </h2>
            <PeakHoursGrid hours={peakHours ?? []} loading={loadingPeakHours} />
            {/* Legend */}
            <div className="flex items-center gap-3 mt-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
                <span>Sem pedidos</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-300" />
                <span>Moderado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-700" />
                <span>Pico</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-purple-600" />
            Receita por forma de pagamento
          </h2>
          <PaymentBreakdownChart items={paymentBreakdown ?? []} loading={loadingPayments} />
        </div>
      </main>
    </div>
  )
}
