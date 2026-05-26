import { useEffect, useMemo, useRef, useState } from 'react'
import { Bike, Minus, Plus, Search, ShoppingBag, Trash2, Utensils, X } from 'lucide-react'

import { useCategories } from '../../hooks/useCategories'
import { useDeliveryConfig } from '../../hooks/useDelivery'
import { useCreateAdminOrder } from '../../hooks/useOrders'
import { useProducts } from '../../hooks/useProducts'
import type { Product } from '../../services/products.service'
import { calculateDeliveryFee, geocodeAddress } from '../../services/delivery.service'
import { useStore } from '../../hooks/useStore'
import { useTables } from '../../hooks/useTables'
import type { AdminPaymentMethod, CreateAdminOrderDto } from '../../services/orders.service'
import { useAdminCartStore } from '../../store/useAdminCartStore'

import { PdvItemModal } from './PdvItemModal'

import { useViaCep } from '@/modules/auth/hooks/useViaCep'
import { resolveImageUrl } from '@/shared/lib/imageUrl'
import { toast } from '@/shared/lib/toast'

// ─── PDV: drawer de novo pedido (telefone/balcão) ────────────────────────────
// Reaproveita o motor de pedidos do backend via POST /admin/orders. Catálogo
// vem do admin (useProducts → variations + addons). Mesa é selecionada por
// tableId; o backend abre/anexa a TableSession. Pagamento segue o
// autoConfirmOrders da loja (decisão do produto), sem confirmação extra aqui.

type OrderType = 'DELIVERY' | 'PICKUP' | 'TABLE'

interface Props {
  open: boolean
  onClose: () => void
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500'

// Opções de pagamento por tipo de pedido. Mesa usa métodos presenciais limpos
// (+ PENDING "definir depois"); delivery/retirada usam PIX + presencial/balcão.
const TABLE_PAYMENTS: Array<{ value: AdminPaymentMethod; label: string }> = [
  { value: 'PENDING', label: 'Definir depois' },
  { value: 'PIX', label: 'Pix' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'CREDIT', label: 'Crédito' },
  { value: 'DEBIT', label: 'Débito' },
]
const COUNTER_PAYMENTS: Array<{ value: AdminPaymentMethod; label: string }> = [
  { value: 'PIX', label: 'Pix' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'CREDIT', label: 'Crédito' },
  { value: 'DEBIT', label: 'Débito' },
]

export function NewOrderDrawer({ open, onClose }: Props) {
  const { data: store } = useStore()
  const { data: products } = useProducts()
  const { data: categories } = useCategories()
  const { data: tables } = useTables()
  const { data: deliveryConfig } = useDeliveryConfig()
  const createOrder = useCreateAdminOrder()

  const items = useAdminCartStore((s) => s.items)
  const subtotal = useAdminCartStore((s) => s.subtotal)
  const updateQty = useAdminCartStore((s) => s.updateQty)
  const removeItem = useAdminCartStore((s) => s.removeItem)
  const clearCart = useAdminCartStore((s) => s.clear)

  const [type, setType] = useState<OrderType>('DELIVERY')
  const [clientName, setClientName] = useState('')
  const [tableId, setTableId] = useState<string>('')
  const [payment, setPayment] = useState<AdminPaymentMethod>('PIX')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [configProduct, setConfigProduct] = useState<Product | null>(null)

  // Endereço (delivery)
  const [useNeighborhood, setUseNeighborhood] = useState(false)
  const [neighborhoodId, setNeighborhoodId] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [reference, setReference] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [zipCode, setZipCode] = useState('')

  // Frete calculado ao vivo (mesma mecânica do checkout do cliente).
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [feeLoading, setFeeLoading] = useState(false)
  const [feeError, setFeeError] = useState('')
  const { lookup: lookupCep, isLoading: cepLoading } = useViaCep()

  const neighborhoods = useMemo(
    () => (deliveryConfig?.neighborhoods ?? []).filter((n) => n.isAvailable),
    [deliveryConfig]
  )

  // Tipos habilitados pela loja.
  const allowedTypes: OrderType[] = useMemo(() => {
    const t: OrderType[] = []
    if (store?.allowDelivery) t.push('DELIVERY')
    if (store?.allowPickup) t.push('PICKUP')
    if (store?.allowTable) t.push('TABLE')
    return t.length ? t : ['DELIVERY']
  }, [store])

  const filteredProducts = useMemo(() => {
    const active = (products ?? []).filter((p) => p.isActive)
    if (!search.trim()) return active
    const term = search.toLowerCase()
    return active.filter((p) => p.name.toLowerCase().includes(term))
  }, [products, search])

  // Agrupa por categoria (ordem das categorias do admin).
  const grouped = useMemo(() => {
    const byCat = new Map<string, Product[]>()
    for (const p of filteredProducts) {
      const list = byCat.get(p.categoryId) ?? []
      list.push(p)
      byCat.set(p.categoryId, list)
    }
    const ordered = (categories ?? [])
      .filter((c) => c.isActive)
      .map((c) => ({ id: c.id, name: c.name, products: byCat.get(c.id) ?? [] }))
      .filter((g) => g.products.length > 0)
    return ordered
  }, [filteredProducts, categories])

  const paymentOptions = type === 'TABLE' ? TABLE_PAYMENTS : COUNTER_PAYMENTS
  const cartTotal = subtotal()
  const orderTotal = cartTotal + (type === 'DELIVERY' ? deliveryFee : 0)

  // Recalcula frete ao vivo (debounce 600ms) — espelha o checkout do cliente.
  // Modo bairro: taxa fixa por id. Modo distância: geocode rua+número → cálculo.
  // Não-delivery zera tudo. subtotalCents deixa o backend zerar se bate frete
  // grátis, igual ao createOrder.
  const subtotalCents = Math.round(cartTotal * 100)
  const feeReqId = useRef(0)
  useEffect(() => {
    if (type !== 'DELIVERY') {
      setDeliveryFee(0)
      setFeeError('')
      setFeeLoading(false)
      return
    }

    const ready = useNeighborhood
      ? !!neighborhoodId
      : street.trim().length > 0 && number.trim().length > 0
    if (!ready) {
      setDeliveryFee(0)
      setFeeError('')
      return
    }

    const reqId = ++feeReqId.current
    const timer = setTimeout(async () => {
      setFeeLoading(true)
      setFeeError('')
      try {
        if (useNeighborhood) {
          const r = await calculateDeliveryFee({ neighborhoodId, subtotalCents })
          if (reqId === feeReqId.current) setDeliveryFee(r.fee)
        } else {
          const coords = await geocodeAddress({
            cep: zipCode || undefined,
            street,
            number,
            neighborhood: neighborhood || undefined,
            city: city || undefined,
          })
          const r = await calculateDeliveryFee({
            latitude: coords.latitude,
            longitude: coords.longitude,
            subtotalCents,
          })
          if (reqId === feeReqId.current) setDeliveryFee(r.fee)
        }
      } catch (err: unknown) {
        if (reqId !== feeReqId.current) return
        const raw =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? ''
        // "Nenhuma faixa configurada" é problema de config da loja → silencia
        // (backend é leniente no submit). Demais erros aparecem pro atendente.
        const friendly = /nenhuma faixa/i.test(raw)
          ? ''
          : /fora da [áa]rea/i.test(raw)
            ? 'Endereço fora da área de entrega.'
            : /endere[çc]o n[ãa]o encontrado/i.test(raw)
              ? 'Endereço não localizado — a taxa será confirmada no envio.'
              : raw || 'Não foi possível calcular o frete.'
        setDeliveryFee(0)
        setFeeError(friendly)
      } finally {
        if (reqId === feeReqId.current) setFeeLoading(false)
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [type, useNeighborhood, neighborhoodId, street, number, neighborhood, city, zipCode, subtotalCents])

  // CEP completo (8 dígitos) → autopreenche rua/bairro/cidade via backend.
  async function handleCepBlur() {
    const digits = zipCode.replace(/\D/g, '')
    if (digits.length !== 8) return
    const result = await lookupCep(digits)
    if (!result) return
    if (result.street) setStreet(result.street)
    if (result.neighborhood) setNeighborhood(result.neighborhood)
    if (result.city) setCity(result.city)
  }

  function resetAndClose() {
    clearCart()
    setType(allowedTypes[0] ?? 'DELIVERY')
    setClientName('')
    setTableId('')
    setPayment('PIX')
    setNotes('')
    setSearch('')
    setUseNeighborhood(false)
    setNeighborhoodId('')
    setStreet('')
    setNumber('')
    setComplement('')
    setReference('')
    setNeighborhood('')
    setCity('')
    setZipCode('')
    setDeliveryFee(0)
    setFeeError('')
    onClose()
  }

  function handleTypeChange(next: OrderType) {
    setType(next)
    // Pagamento default coerente com o tipo (mesa começa em "definir depois").
    setPayment(next === 'TABLE' ? 'PENDING' : 'PIX')
  }

  function validate(): string | null {
    if (!clientName.trim()) return 'Informe o nome do cliente'
    if (items.length === 0) return 'Adicione ao menos um item ao pedido'
    if (type === 'TABLE' && !tableId) return 'Selecione a mesa'
    if (type === 'DELIVERY') {
      if (useNeighborhood && !neighborhoodId) return 'Selecione o bairro de entrega'
      if (!useNeighborhood && (!street.trim() || !number.trim()))
        return 'Preencha rua e número da entrega'
    }
    return null
  }

  function handleSubmit() {
    const error = validate()
    if (error) {
      toast.error(error)
      return
    }

    const dto: CreateAdminOrderDto = {
      clientName: clientName.trim(),
      type,
      paymentMethod: payment,
      notes: notes.trim() || undefined,
      items: items.map((i) => ({
        productId: i.productId,
        variationId: i.variationId,
        quantity: i.quantity,
        notes: i.notes,
        addonIds: i.addons.map((a) => a.id),
      })),
    }

    if (type === 'TABLE') dto.tableId = tableId
    if (type === 'DELIVERY') {
      if (useNeighborhood) {
        dto.deliveryNeighborhoodId = neighborhoodId
        dto.address = { street: street.trim(), number: number.trim() }
      } else {
        dto.address = {
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim() || undefined,
          reference: reference.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
          city: city.trim() || undefined,
          zipCode: zipCode.trim() || undefined,
        }
      }
    }

    createOrder.mutate(dto, {
      onSuccess: (res) => {
        toast.success(`Pedido #${res.orderNumber} criado`, fmt(res.total))
        resetAndClose()
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
            ?.error ??
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Não foi possível criar o pedido'
        toast.error(msg)
      },
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="bg-gray-50 w-full max-w-5xl h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Novo pedido</h2>
          <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Coluna esquerda: formulário */}
          <div className="w-[420px] flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-5 space-y-5">
            {/* Tipo */}
            <div className="grid grid-cols-3 gap-2">
              {allowedTypes.includes('DELIVERY') && (
                <TypeButton
                  active={type === 'DELIVERY'}
                  onClick={() => handleTypeChange('DELIVERY')}
                  icon={<Bike className="w-4 h-4" />}
                  label="Delivery"
                />
              )}
              {allowedTypes.includes('TABLE') && (
                <TypeButton
                  active={type === 'TABLE'}
                  onClick={() => handleTypeChange('TABLE')}
                  icon={<Utensils className="w-4 h-4" />}
                  label="Mesa"
                />
              )}
              {allowedTypes.includes('PICKUP') && (
                <TypeButton
                  active={type === 'PICKUP'}
                  onClick={() => handleTypeChange('PICKUP')}
                  icon={<ShoppingBag className="w-4 h-4" />}
                  label="Retirada"
                />
              )}
            </div>

            {/* Cliente */}
            <Field label="Cliente">
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nome do cliente"
                className={inputCls}
              />
            </Field>

            {/* Mesa */}
            {type === 'TABLE' && (
              <Field label="Mesa">
                <div className="grid grid-cols-5 gap-2">
                  {(tables ?? []).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTableId(t.id)}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                        tableId === t.id
                          ? 'bg-red-500 text-white border-red-500'
                          : t.isOccupied
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                      title={t.isOccupied ? 'Mesa ocupada — pedido entra na comanda atual' : 'Mesa livre'}
                    >
                      {t.number}
                    </button>
                  ))}
                  {(tables ?? []).length === 0 && (
                    <p className="col-span-5 text-xs text-gray-400">Nenhuma mesa cadastrada.</p>
                  )}
                </div>
              </Field>
            )}

            {/* Endereço (delivery) */}
            {type === 'DELIVERY' && (
              <div className="space-y-3">
                {neighborhoods.length > 0 && (
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={useNeighborhood}
                      onChange={(e) => setUseNeighborhood(e.target.checked)}
                      className="accent-red-500"
                    />
                    Cobrar frete por bairro
                  </label>
                )}

                {useNeighborhood ? (
                  <>
                    <Field label="Bairro">
                      <select
                        value={neighborhoodId}
                        onChange={(e) => setNeighborhoodId(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Selecione…</option>
                        {neighborhoods.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.name} — {fmt(n.fee)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Field label="Rua">
                          <input value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} />
                        </Field>
                      </div>
                      <Field label="Número">
                        <input value={number} onChange={(e) => setNumber(e.target.value)} className={inputCls} />
                      </Field>
                    </div>
                  </>
                ) : (
                  <>
                    {/* CEP primeiro — autopreenche rua/bairro/cidade, igual ao checkout. */}
                    <Field label="CEP">
                      <input
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        onBlur={handleCepBlur}
                        placeholder={cepLoading ? 'Buscando…' : '00000-000'}
                        className={inputCls}
                      />
                    </Field>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Field label="Rua">
                          <input value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} />
                        </Field>
                      </div>
                      <Field label="Número">
                        <input value={number} onChange={(e) => setNumber(e.target.value)} className={inputCls} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Bairro">
                        <input
                          value={neighborhood}
                          onChange={(e) => setNeighborhood(e.target.value)}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="Cidade">
                        <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
                      </Field>
                    </div>
                    <Field label="Complemento">
                      <input
                        value={complement}
                        onChange={(e) => setComplement(e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Ponto de referência">
                      <input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Ex: portão azul, ao lado da padaria"
                        className={inputCls}
                      />
                    </Field>
                  </>
                )}
              </div>
            )}

            {/* Pagamento */}
            <Field label="Pagamento">
              <div className="grid grid-cols-2 gap-2">
                {paymentOptions.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPayment(p.value)}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      payment === p.value
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Observação geral */}
            <Field label="Observação do pedido">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Coluna central: carrinho */}
          <div className="w-[300px] flex-shrink-0 flex flex-col bg-white border-r border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">Itens do pedido</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {items.length === 0 && (
                <p className="text-sm text-gray-400 text-center mt-6">
                  Clique nos produtos à direita para adicionar.
                </p>
              )}
              {items.map((item) => {
                const addons = item.addons.reduce((s, a) => s + a.price, 0)
                const line = (item.unitPrice + addons) * item.quantity
                return (
                  <div key={item.id} className="border border-gray-100 rounded-lg p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {item.productName}
                        </p>
                        {item.variationName && (
                          <p className="text-xs text-gray-500">{item.variationName}</p>
                        )}
                        {item.addons.map((a) => (
                          <p key={a.id} className="text-xs text-gray-400">
                            + {a.name}
                          </p>
                        ))}
                        {item.notes && (
                          <p className="text-xs text-gray-400 italic">{item.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-gray-300 hover:text-red-500 flex-shrink-0"
                        aria-label="Remover item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg">
                        <button
                          onClick={() => updateQty(item.id, item.quantity - 1)}
                          className="px-2 py-1 text-gray-500 hover:text-gray-700"
                          aria-label="Diminuir"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center text-xs font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.id, item.quantity + 1)}
                          className="px-2 py-1 text-gray-500 hover:text-gray-700"
                          aria-label="Aumentar"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{fmt(line)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Total + finalizar */}
            <div className="border-t border-gray-100 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-700">{fmt(cartTotal)}</span>
              </div>
              {type === 'DELIVERY' && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Frete</span>
                  <span className="text-gray-700">
                    {feeLoading ? 'Calculando…' : deliveryFee > 0 ? fmt(deliveryFee) : 'Grátis'}
                  </span>
                </div>
              )}
              {feeError && <p className="text-xs text-amber-600">{feeError}</p>}
              <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-100">
                <span className="font-medium text-gray-700">Total</span>
                <span className="font-semibold text-gray-900">{fmt(orderTotal)}</span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={createOrder.isPending}
                className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors mt-1"
              >
                {createOrder.isPending ? 'Criando…' : 'Finalizar pedido'}
              </button>
            </div>
          </div>

          {/* Coluna direita: catálogo */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar produto…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {grouped.length === 0 && (
                <p className="text-sm text-gray-400 text-center mt-6">Nenhum produto encontrado.</p>
              )}
              {grouped.map((g) => (
                <div key={g.id}>
                  <p className="text-sm font-semibold text-gray-700 mb-2">{g.name}</p>
                  <div className="space-y-1.5">
                    {g.products.map((p) => {
                      const img = resolveImageUrl(p.imageUrl)
                      const price =
                        p.variations.filter((v) => v.isActive)[0]?.price ?? p.basePrice ?? 0
                      const hasVariations = p.variations.some((v) => v.isActive)
                      return (
                        <button
                          key={p.id}
                          onClick={() => setConfigProduct(p)}
                          className="w-full flex items-center gap-3 text-left border border-gray-100 rounded-lg p-2 hover:border-red-200 hover:bg-red-50/30 transition-colors"
                        >
                          {img ? (
                            <img src={img} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                            {p.description && (
                              <p className="text-xs text-gray-400 truncate">{p.description}</p>
                            )}
                            <p className="text-sm text-gray-600">
                              {hasVariations ? 'a partir de ' : ''}
                              {fmt(price)}
                            </p>
                          </div>
                          <Plus className="w-5 h-5 text-red-500 flex-shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {configProduct && (
        <PdvItemModal product={configProduct} onClose={() => setConfigProduct(null)} />
      )}
    </div>
  )
}

function TypeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
        active
          ? 'bg-red-500 text-white border-red-500'
          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
