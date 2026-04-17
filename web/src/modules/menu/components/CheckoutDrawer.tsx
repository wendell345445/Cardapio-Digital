import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, ShoppingBag, ArrowLeft, Trash2, Minus, Plus, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

import { useCartStore } from '../store/useCartStore'
import { useMenu } from '../hooks/useMenu'
import { useCreateOrder } from '../hooks/useOrder'
import { calculateDeliveryFee as fetchDeliveryFee } from '../services/orders.service'
import { useCustomerAuth } from '../hooks/useCustomerAuth'

import { useViaCep } from '@/modules/auth/hooks/useViaCep'
import { maskCep } from '@/shared/lib/masks'
import { useStoreSlug } from '@/hooks/useStoreSlug'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const PAYMENT_METHODS = [
  'PIX',
  'CREDIT_CARD',
  'CREDIT_ON_DELIVERY',
  'DEBIT_ON_DELIVERY',
  'PIX_ON_DELIVERY',
] as const
type PaymentMethod = (typeof PAYMENT_METHODS)[number]
type PaymentGroup = 'PIX' | 'CREDIT_CARD' | 'ON_DELIVERY'

const ON_DELIVERY_METHODS: PaymentMethod[] = [
  'CREDIT_ON_DELIVERY',
  'DEBIT_ON_DELIVERY',
  'PIX_ON_DELIVERY',
]

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  PIX: 'Pix (online)',
  CREDIT_CARD: 'Cartão de Crédito (online)',
  CREDIT_ON_DELIVERY: 'Cartão de Crédito na entrega',
  DEBIT_ON_DELIVERY: 'Cartão de Débito na entrega',
  PIX_ON_DELIVERY: 'Pix na entrega',
}

// ViaCEP devolve só a UF (2 letras). Mapa pra mostrar o nome completo no checkout.
const UF_TO_STATE: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso',
  PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima',
  RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo',
  TO: 'Tocantins',
}

function ufToStateName(uf: string): string {
  return UF_TO_STATE[uf.toUpperCase()] ?? uf
}

// Traduz paths de erros Zod pra nomes amigáveis no checkout público.
const FIELD_LABELS: Record<string, string> = {
  clientWhatsapp: 'WhatsApp',
  clientName: 'Nome',
  type: 'Tipo do pedido',
  paymentMethod: 'Forma de pagamento',
  'address.street': 'Rua',
  'address.number': 'Número',
  'address.neighborhood': 'Bairro',
  'address.city': 'Cidade',
  'address.zipCode': 'CEP',
  items: 'Itens',
}

interface OrderAxiosError {
  response?: {
    data?: {
      error?: string
      message?: string
      details?: Array<{ path?: Array<string | number>; message?: string }>
    }
  }
}

function extractOrderErrorMessages(err: unknown): string[] {
  const axiosErr = err as OrderAxiosError
  const data = axiosErr?.response?.data
  if (!data) return ['Erro ao criar pedido']
  if (Array.isArray(data.details) && data.details.length > 0) {
    return data.details.map(d => {
      const pathKey = (d.path ?? []).join('.')
      const label = FIELD_LABELS[pathKey] ?? pathKey
      const msg = d.message ?? 'inválido'
      return label ? `${label}: ${msg}` : msg
    })
  }
  return [data.error ?? data.message ?? 'Erro ao criar pedido']
}

function paymentGroupFor(m: PaymentMethod): PaymentGroup {
  if (m === 'PIX') return 'PIX'
  if (m === 'CREDIT_CARD') return 'CREDIT_CARD'
  return 'ON_DELIVERY'
}

const schema = z
  .object({
    clientWhatsapp: z.string().length(11, 'Informe 11 dígitos (com DDD)'),
    clientName: z.string().min(1, 'Informe seu nome').optional(),
    type: z.enum(['DELIVERY', 'PICKUP', 'TABLE']),
    paymentMethod: z.enum(PAYMENT_METHODS),
    zipCode: z.string().optional(),
    street: z.string().optional(),
    number: z.string().optional(),
    complement: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    notes: z.string().optional(),
    couponCode: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== 'DELIVERY') return
    const required: Array<{ key: 'street' | 'number' | 'neighborhood' | 'city'; msg: string }> = [
      { key: 'street', msg: 'Rua obrigatória' },
      { key: 'number', msg: 'Número obrigatório' },
      { key: 'neighborhood', msg: 'Bairro obrigatório' },
      { key: 'city', msg: 'Cidade obrigatória' },
    ]
    for (const { key, msg } of required) {
      const value = data[key]
      if (!value || value.trim() === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: [key] })
      }
    }
  })

type CheckoutForm = z.infer<typeof schema>

interface CheckoutDrawerProps {
  open: boolean
  onClose: () => void
}

export function CheckoutDrawer({ open, onClose }: CheckoutDrawerProps) {
  const slug = useStoreSlug()
  const navigate = useNavigate()
  const { data: menu } = useMenu(slug)

  const items = useCartStore(s => s.items)
  const subtotal = useCartStore(s => s.subtotal)
  const clearCart = useCartStore(s => s.clearCart)
  const updateQty = useCartStore(s => s.updateQty)
  const removeItem = useCartStore(s => s.removeItem)
  const tableNumber = useCartStore(s => s.tableNumber)

  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  function itemUnitPrice(item: typeof items[number]): number {
    const base = item.variationPrice ?? item.unitPrice
    const adds = item.additionals.reduce((s, a) => s + a.price, 0)
    return base + adds
  }
  const mutation = useCreateOrder(slug ?? '')

  const [couponError, setCouponError] = useState('')
  const [itemsOpen, setItemsOpen] = useState(true)
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [deliveryFeeLoading, setDeliveryFeeLoading] = useState(false)
  const [deliveryFeeError, setDeliveryFeeError] = useState('')
  const [otpInput, setOtpInput] = useState('')
  const { lookup: cepLookup, isLoading: cepLoading, error: cepError } = useViaCep()

  const auth = useCustomerAuth()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CheckoutForm>({
    resolver: zodResolver(schema),
    // C-022: se entrou via QR de mesa, força type=TABLE
    defaultValues: { type: tableNumber ? 'TABLE' : 'DELIVERY', paymentMethod: 'PIX' },
  })

  const orderType = watch('type')
  const paymentMethod = watch('paymentMethod') as PaymentMethod
  const zipCode = watch('zipCode')
  const store = menu?.store

  const paymentGroup = paymentGroupFor(paymentMethod)

  // "Pagar na entrega" só existe quando o pedido é entrega — se trocar pra retirada
  // enquanto um método on-delivery está selecionado, volta pro PIX como default.
  useEffect(() => {
    if (orderType === 'PICKUP' && ON_DELIVERY_METHODS.includes(paymentMethod)) {
      setValue('paymentMethod', 'PIX')
    }
  }, [orderType, paymentMethod, setValue])

  // Prefill form quando cliente é verificado
  useEffect(() => {
    if (auth.step !== 'verified' || !auth.customerData) return
    setValue('clientWhatsapp', auth.customerData.whatsapp, { shouldValidate: true })
    if (auth.customerData.name) {
      setValue('clientName', auth.customerData.name, { shouldValidate: true })
    }
    if (auth.customerData.address) {
      const addr = auth.customerData.address
      if (addr.zipCode) setValue('zipCode', addr.zipCode)
      if (addr.street) setValue('street', addr.street)
      if (addr.number) setValue('number', addr.number)
      if (addr.complement) setValue('complement', addr.complement)
      if (addr.neighborhood) setValue('neighborhood', addr.neighborhood)
      if (addr.city) setValue('city', addr.city)
    }
  }, [auth.step, auth.customerData, setValue])

  function selectPaymentGroup(group: PaymentGroup) {
    if (group === 'PIX') setValue('paymentMethod', 'PIX')
    else if (group === 'CREDIT_CARD') setValue('paymentMethod', 'CREDIT_CARD')
    else setValue('paymentMethod', 'CREDIT_ON_DELIVERY')
  }

  const total = subtotal() + deliveryFee

  const lookupDeliveryFee = useCallback(async (neighborhood: string) => {
    const trimmed = neighborhood.trim()
    if (!trimmed) {
      setDeliveryFee(0)
      setDeliveryFeeError('')
      return
    }
    setDeliveryFeeLoading(true)
    setDeliveryFeeError('')
    try {
      const result = await fetchDeliveryFee(trimmed)
      setDeliveryFee(result.fee)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      const msg = axiosErr?.response?.data?.error ?? 'Erro ao calcular taxa'
      setDeliveryFeeError(msg)
      setDeliveryFee(0)
    } finally {
      setDeliveryFeeLoading(false)
    }
  }, [])

  // Reset fee when switching away from DELIVERY
  useEffect(() => {
    if (orderType !== 'DELIVERY') {
      setDeliveryFee(0)
      setDeliveryFeeError('')
    }
  }, [orderType])

  async function handleCepBlur() {
    const digits = (zipCode ?? '').replace(/\D/g, '')
    if (digits.length !== 8) return
    const result = await cepLookup(digits)
    if (!result) return
    if (result.street) setValue('street', result.street, { shouldValidate: true })
    if (result.neighborhood) {
      setValue('neighborhood', result.neighborhood, { shouldValidate: true })
      lookupDeliveryFee(result.neighborhood)
    }
    if (result.city) setValue('city', result.city, { shouldValidate: true })
    if (result.state) setValue('state', ufToStateName(result.state))
  }

  const onSubmit = async (form: CheckoutForm) => {
    setCouponError('')
    try {
      const result = await mutation.mutateAsync({
        clientWhatsapp: form.clientWhatsapp,
        clientName: form.clientName,
        type: form.type,
        paymentMethod: form.paymentMethod,
        notes: form.notes,
        couponCode: form.couponCode || undefined,
        address: form.type === 'DELIVERY' ? {
          zipCode: form.zipCode,
          street: form.street!,
          number: form.number!,
          complement: form.complement,
          neighborhood: form.neighborhood!,
          city: form.city!,
          state: form.state,
        } : undefined,
        tableNumber: form.type === 'TABLE' && tableNumber ? tableNumber : undefined,
        items: items.map(i => ({
          productId: i.productId,
          variationId: i.variationId,
          quantity: i.quantity,
          notes: i.notes,
          additionalIds: i.additionals.map(a => a.id),
        })),
      })
      clearCart()
      onClose()
      navigate(`/pedido/${result.token}`, { state: result })
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; message?: string; details?: Array<{ path?: Array<string | number>; message?: string }> } } }
      const msg = axiosErr?.response?.data?.error || axiosErr?.response?.data?.message || 'Erro ao criar pedido'
      if (msg.includes('Cupom')) setCouponError(msg)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full sm:max-w-md bg-white z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="w-4 h-4 text-red-500" />
              <span className="text-xs font-semibold text-red-500 uppercase tracking-wide">
                Checkout rápido
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Finalize seu pedido</h2>
            <p className="text-xs text-gray-400">Finalizado em {store?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resumo topo */}
        <div className="bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <div>
              <p className="text-xl font-bold text-gray-900">{fmt(total)}</p>
              <button
                type="button"
                onClick={() => setItemsOpen(o => !o)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <span>{totalQty} item(s) no pedido</span>
                {itemsOpen
                  ? <ChevronUp className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Adicionar mais itens
            </button>
          </div>

          {itemsOpen && items.length > 0 && (
            <ul className="px-5 pb-3 space-y-2 text-sm max-h-[40vh] overflow-y-auto">
              {items.map(item => {
                const unit = itemUnitPrice(item)
                const lineTotal = unit * item.quantity
                return (
                  <li
                    key={item.id}
                    data-testid={`cart-item-${item.id}`}
                    className="flex items-start gap-3 bg-white rounded-lg border border-gray-100 p-3"
                  >
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {item.productName}
                        {item.variationName && ` — ${item.variationName}`}
                      </p>
                      {item.additionals.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          + {item.additionals.map(a => a.name).join(', ')}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-gray-400 italic mt-0.5 truncate">Obs: {item.notes}</p>
                      )}
                      <div className="flex items-center justify-between mt-2 gap-2">
                        <div className="inline-flex items-center border border-gray-200 rounded-full bg-white">
                          <button
                            type="button"
                            aria-label="Diminuir quantidade"
                            onClick={() => updateQty(item.id, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-50 rounded-l-full"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span
                            className="w-7 text-center text-sm font-medium"
                            data-testid={`cart-item-qty-${item.id}`}
                          >
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Aumentar quantidade"
                            onClick={() => updateQty(item.id, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-50 rounded-r-full"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                          {fmt(lineTotal)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remover ${item.productName}`}
                      onClick={() => removeItem(item.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-5">
            {/* Tipo de entrega */}
            {tableNumber ? (
              <div className="p-3 rounded-lg border-2 border-blue-500 bg-blue-50 text-blue-700 text-sm font-medium text-center">
                <input type="hidden" value="TABLE" {...register('type')} />
                🍽️ Pedido para Mesa {tableNumber}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[
                  ...(store?.allowDelivery !== false ? ['DELIVERY'] : []),
                  ...(store?.allowPickup ? ['PICKUP'] : []),
                ].map(t => (
                  <label
                    key={t}
                    className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer text-sm font-medium transition-colors ${
                      orderType === t
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <input type="radio" value={t} {...register('type')} className="sr-only" />
                    {t === 'DELIVERY' ? '🛵 Entrega' : '🏪 Retirar no local'}
                  </label>
                ))}
              </div>
            )}

            {/* Seus dados — fluxo de verificação */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Seus dados
              </h3>

              {/* Step: loading */}
              {auth.step === 'loading' && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-400">Verificando...</span>
                </div>
              )}

              {/* Step: phone — digitar WhatsApp */}
              {auth.step === 'phone' && (
                <div className="space-y-2">
                  <div>
                    <input
                      type="tel"
                      placeholder="Seu WhatsApp (com DDD)"
                      value={auth.whatsapp}
                      onChange={(e) => auth.setWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      maxLength={11}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      style={{ fontSize: 16 }}
                    />
                  </div>
                  {auth.error && (
                    <p className="text-red-500 text-xs">{auth.error}</p>
                  )}
                  <button
                    type="button"
                    onClick={auth.submitPhone}
                    disabled={auth.whatsapp.length !== 11}
                    className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                  >
                    Continuar
                  </button>
                </div>
              )}

              {/* Step: otp — código de verificação */}
              {auth.step === 'otp' && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
                    Enviamos um código de 4 dígitos para <strong>{auth.whatsapp}</strong> via WhatsApp.
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Digite o código"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                    style={{ fontSize: 20 }}
                  />
                  {auth.error && (
                    <p className="text-red-500 text-xs">{auth.error}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => auth.submitOtp(otpInput)}
                    disabled={otpInput.length !== 4}
                    className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                  >
                    Verificar
                  </button>
                  <div className="flex justify-between text-xs">
                    <button
                      type="button"
                      onClick={auth.resendOtp}
                      disabled={auth.otpCountdown > 0}
                      className="text-red-500 disabled:text-gray-400"
                    >
                      {auth.otpCountdown > 0 ? `Reenviar em ${auth.otpCountdown}s` : 'Reenviar código'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { auth.reset(); setOtpInput('') }}
                      className="text-gray-500"
                    >
                      Usar outro número
                    </button>
                  </div>
                </div>
              )}

              {/* Step: verified — dados confirmados */}
              {auth.step === 'verified' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-sm text-green-800">
                      WhatsApp verificado: <strong>{auth.whatsapp}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={auth.reset}
                      className="text-xs text-green-600 hover:text-green-800"
                    >
                      Trocar
                    </button>
                  </div>
                  <input type="hidden" {...register('clientWhatsapp')} />
                  <input
                    type="text"
                    placeholder="Seu nome"
                    {...register('clientName')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    style={{ fontSize: 16 }}
                  />
                </div>
              )}
            </div>

            {/* Seções visíveis somente após verificação do WhatsApp */}
            {auth.step !== 'verified' ? (
              <p className="text-xs text-gray-400 text-center py-2">
                Verifique seu WhatsApp acima para continuar.
              </p>
            ) : (
            <>

            {/* Endereço delivery */}
            {orderType === 'DELIVERY' && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Endereço
                </h3>
                <div>
                  <input
                    type="text"
                    placeholder="CEP"
                    inputMode="numeric"
                    value={zipCode ?? ''}
                    onChange={(e) => setValue('zipCode', maskCep(e.target.value))}
                    onBlur={handleCepBlur}
                    maxLength={9}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    style={{ fontSize: 16 }}
                  />
                  {cepLoading && (
                    <p className="text-gray-400 text-xs mt-1">Buscando endereço…</p>
                  )}
                  {cepError && !cepLoading && (
                    <p className="text-red-500 text-xs mt-1">{cepError}</p>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Rua"
                    {...register('street')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    style={{ fontSize: 16 }}
                  />
                  {errors.street && (
                    <p className="text-red-500 text-xs mt-1">{errors.street.message}</p>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Número *"
                    {...register('number')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    style={{ fontSize: 16 }}
                  />
                  {errors.number && (
                    <p className="text-red-500 text-xs mt-1">{errors.number.message}</p>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Complemento (opcional)"
                  {...register('complement')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  style={{ fontSize: 16 }}
                />
                <div>
                  <input
                    type="text"
                    placeholder="Bairro"
                    {...register('neighborhood')}
                    onBlur={(e) => lookupDeliveryFee(e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
                      deliveryFeeError ? 'border-red-400' : 'border-gray-200'
                    }`}
                    style={{ fontSize: 16 }}
                  />
                  {deliveryFeeLoading && (
                    <p className="text-gray-400 text-xs mt-1">Calculando taxa de entrega…</p>
                  )}
                  {deliveryFeeError && (
                    <p className="text-red-500 text-xs mt-1">{deliveryFeeError}</p>
                  )}
                  {errors.neighborhood && !deliveryFeeError && (
                    <p className="text-red-500 text-xs mt-1">{errors.neighborhood.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      placeholder="Cidade"
                      {...register('city')}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      style={{ fontSize: 16 }}
                    />
                    {errors.city && (
                      <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Estado"
                    {...register('state')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    style={{ fontSize: 16 }}
                  />
                </div>
              </div>
            )}

            {/* Pagamento — sempre mostra as 3 opções principais */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Pagamento
              </h3>

              {store?.features?.allowPix !== false && store?.pixKey && (
                <button
                  type="button"
                  onClick={() => selectPaymentGroup('PIX')}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-sm text-left transition-colors ${paymentGroup === 'PIX' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 ${paymentGroup === 'PIX' ? 'border-red-500 bg-red-500' : 'border-gray-300'}`} />
                  <span className="font-medium">💰 Pix (online)</span>
                </button>
              )}

              {store?.allowCreditCard && (
                <button
                  type="button"
                  onClick={() => selectPaymentGroup('CREDIT_CARD')}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 text-sm text-left transition-colors ${paymentGroup === 'CREDIT_CARD' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 mt-0.5 ${paymentGroup === 'CREDIT_CARD' ? 'border-red-500 bg-red-500' : 'border-gray-300'}`} />
                  <span className="flex-1">
                    <span className="font-medium block">💳 Cartão de Crédito (online)</span>
                    <span className="text-xs text-gray-400">Integração com gateway em breve</span>
                  </span>
                </button>
              )}

              {store?.allowCashOnDelivery && orderType === 'DELIVERY' && (
                <div className={`rounded-lg border-2 transition-colors ${paymentGroup === 'ON_DELIVERY' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                  <button
                    type="button"
                    onClick={() => selectPaymentGroup('ON_DELIVERY')}
                    className="w-full flex items-center gap-3 p-3 text-sm text-left"
                  >
                    <span className={`w-4 h-4 rounded-full border-2 ${paymentGroup === 'ON_DELIVERY' ? 'border-red-500 bg-red-500' : 'border-gray-300'}`} />
                    <span className="font-medium flex-1">💵 Pagar na entrega</span>
                    {paymentGroup === 'ON_DELIVERY'
                      ? <ChevronUp className="w-4 h-4 text-gray-400" />
                      : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {paymentGroup === 'ON_DELIVERY' && (
                    <div className="px-3 pb-3 space-y-1.5">
                      {ON_DELIVERY_METHODS.map(method => (
                        <label
                          key={method}
                          className={`flex items-center gap-2 p-2 rounded-md cursor-pointer text-sm ${paymentMethod === method ? 'bg-white border border-red-300' : 'bg-white/60 border border-transparent hover:bg-white'}`}
                        >
                          <input
                            type="radio"
                            value={method}
                            {...register('paymentMethod')}
                            className="accent-red-500"
                          />
                          <span>{PAYMENT_LABELS[method].replace(' na entrega', '')}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'PIX' && store?.features?.allowPix !== false && store?.pixKey && (
                <div className="p-3 bg-yellow-50 rounded-lg text-xs text-yellow-800">
                  <p className="font-semibold">Chave Pix ({store.pixKeyType}): {store.pixKey}</p>
                  <p className="mt-0.5">Envie o comprovante via WhatsApp após o pedido.</p>
                </div>
              )}
              {paymentMethod === 'CREDIT_CARD' && (
                <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
                  O pagamento online por cartão ainda não está ativo. A loja confirmará o
                  pagamento por WhatsApp após o pedido.
                </div>
              )}
            </div>

            {/* Cupom */}
            <div>
              <input
                type="text"
                placeholder="Código do cupom (opcional)"
                {...register('couponCode')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-red-500"
                style={{ fontSize: 16 }}
              />
              {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
            </div>

            {/* Resumo financeiro */}
            <div className="border border-gray-100 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{fmt(subtotal())}</span>
              </div>
              {orderType === 'DELIVERY' && (
                <div className="flex justify-between text-gray-600">
                  <span>Taxa de entrega</span>
                  <span>
                    {deliveryFeeLoading
                      ? 'Calculando…'
                      : deliveryFee > 0
                        ? fmt(deliveryFee)
                        : 'Grátis'}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-gray-500">
                <span>Pagamento</span>
                <span>{PAYMENT_LABELS[paymentMethod] ?? '—'}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-base">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
            </div>

            {mutation.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 space-y-1">
                <p className="font-semibold">Não foi possível finalizar o pedido:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {extractOrderErrorMessages(mutation.error).map((m, idx) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            </>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 space-y-2">
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={mutation.isPending || items.length === 0 || !!deliveryFeeError || auth.step !== 'verified'}
            className="w-full bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm transition-colors"
          >
            {mutation.isPending ? 'Enviando...' : `Finalizar pedido › ${fmt(total)}`}
          </button>
          <button
            type="button"
            onClick={() => { clearCart(); onClose() }}
            className="w-full text-sm text-gray-400 hover:text-gray-600 py-1"
          >
            Limpar carrinho
          </button>
        </div>
      </div>
    </>
  )
}
