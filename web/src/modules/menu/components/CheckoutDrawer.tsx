import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, ShoppingBag, ArrowLeft } from 'lucide-react'

import { useCartStore } from '../store/useCartStore'
import { useMenu } from '../hooks/useMenu'
import { useCreateOrder } from '../hooks/useOrder'

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

const ON_DELIVERY_METHODS: PaymentMethod[] = [
  'CREDIT_ON_DELIVERY',
  'DEBIT_ON_DELIVERY',
  'PIX_ON_DELIVERY',
]

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de Crédito',
  CREDIT_ON_DELIVERY: 'Crédito na entrega',
  DEBIT_ON_DELIVERY: 'Débito na entrega',
  PIX_ON_DELIVERY: 'Pix na entrega',
}

const schema = z.object({
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
  notes: z.string().optional(),
  couponCode: z.string().optional(),
}).refine(data => {
  if (data.type === 'DELIVERY') {
    return !!data.street && !!data.number && !!data.neighborhood && !!data.city
  }
  return true
}, { message: 'Preencha o endereço', path: ['street'] })

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
  const tableNumber = useCartStore(s => s.tableNumber)
  const mutation = useCreateOrder(slug ?? '')

  const [couponError, setCouponError] = useState('')
  const { lookup: cepLookup, isLoading: cepLoading, error: cepError } = useViaCep()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CheckoutForm>({
    resolver: zodResolver(schema),
    // C-022: se entrou via QR de mesa, força type=TABLE
    defaultValues: { type: tableNumber ? 'TABLE' : 'DELIVERY', paymentMethod: 'PIX' },
  })

  const orderType = watch('type')
  const paymentMethod = watch('paymentMethod') as PaymentMethod
  const zipCode = watch('zipCode')
  const store = menu?.store

  const onDeliverySelected = ON_DELIVERY_METHODS.includes(paymentMethod)

  const deliveryFee = 0 // TODO: integrate with neighborhoods
  const total = subtotal() + deliveryFee

  async function handleCepBlur() {
    const digits = (zipCode ?? '').replace(/\D/g, '')
    if (digits.length !== 8) return
    const result = await cepLookup(digits)
    if (!result) return
    if (result.street) setValue('street', result.street, { shouldValidate: true })
    if (result.neighborhood) setValue('neighborhood', result.neighborhood, { shouldValidate: true })
    if (result.city) setValue('city', result.city, { shouldValidate: true })
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
      const axiosErr = err as { response?: { data?: { error?: string; message?: string } } }
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
        <div className="flex items-center justify-between gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100">
          <div>
            <p className="text-xl font-bold text-gray-900">{fmt(total)}</p>
            <p className="text-xs text-gray-400">{items.length} item(s) no pedido</p>
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

            {/* Seus dados */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Seus dados
              </h3>
              <div>
                <input
                  type="tel"
                  placeholder="Seu WhatsApp (com DDD)"
                  {...register('clientWhatsapp')}
                  maxLength={11}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  style={{ fontSize: 16 }}
                />
                {errors.clientWhatsapp && (
                  <p className="text-red-500 text-xs mt-1">{errors.clientWhatsapp.message}</p>
                )}
              </div>
              <input
                type="text"
                placeholder="Seu nome"
                {...register('clientName')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                style={{ fontSize: 16 }}
              />
            </div>

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
                {[
                  { name: 'street', placeholder: 'Rua' },
                  { name: 'number', placeholder: 'Número' },
                  { name: 'complement', placeholder: 'Complemento (opcional)' },
                  { name: 'neighborhood', placeholder: 'Bairro' },
                  { name: 'city', placeholder: 'Cidade' },
                ].map(f => (
                  <input
                    key={f.name}
                    type="text"
                    placeholder={f.placeholder}
                    {...register(f.name as keyof CheckoutForm)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    style={{ fontSize: 16 }}
                  />
                ))}
                {errors.street && (
                  <p className="text-red-500 text-xs">{errors.street.message}</p>
                )}
              </div>
            )}

            {/* Pagamento */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Pagamento
              </h3>

              {store?.pixKey && (
                <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer text-sm ${paymentMethod === 'PIX' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                  <input type="radio" value="PIX" {...register('paymentMethod')} className="accent-red-500" />
                  <span className="font-medium">💰 Pix (online)</span>
                </label>
              )}

              {store?.allowCreditCard && (
                <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer text-sm ${paymentMethod === 'CREDIT_CARD' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                  <input
                    type="radio"
                    value="CREDIT_CARD"
                    {...register('paymentMethod')}
                    className="accent-red-500 mt-0.5"
                  />
                  <span className="flex-1">
                    <span className="font-medium block">💳 Cartão de Crédito (online)</span>
                    <span className="text-xs text-gray-400">Integração com gateway em breve</span>
                  </span>
                </label>
              )}

              {store?.allowCashOnDelivery && orderType === 'DELIVERY' && (
                <div className={`rounded-lg border-2 ${onDeliverySelected ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                  <div className="p-3 text-sm font-medium">💵 Pagar na entrega</div>
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
                        <span>{PAYMENT_LABELS[method]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {paymentMethod === 'PIX' && store?.pixKey && (
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
              <div className="flex justify-between text-gray-600">
                <span>Taxa de entrega</span>
                <span>{deliveryFee === 0 ? 'Grátis' : fmt(deliveryFee)}</span>
              </div>
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
              <p className="text-red-500 text-xs text-center">
                {(mutation.error as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error ||
                  (mutation.error as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message ||
                  'Erro ao criar pedido'}
              </p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 space-y-2">
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={mutation.isPending || items.length === 0}
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
