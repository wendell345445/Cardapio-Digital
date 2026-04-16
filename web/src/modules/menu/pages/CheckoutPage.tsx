import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarClock, ChevronLeft, CreditCard, MapPin, ShoppingBag, Trash2, Minus, Plus } from 'lucide-react'

import { useCartStore } from '../store/useCartStore'
import { useMenu } from '../hooks/useMenu'
import { useCreateOrder } from '../hooks/useOrder'
import { SuspendedStorePage } from '../components/SuspendedStorePage'

import { useStoreSlug } from '@/hooks/useStoreSlug'

// Minimum scheduling time: 30 minutes from now
function minScheduledAt() {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30)
  return d
}

// Format Date to datetime-local input value (YYYY-MM-DDTHH:mm)
function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const checkoutSchema = z.object({
  clientWhatsapp: z.string().length(11, 'Informe 11 dígitos (com DDD, sem espaços)'),
  clientName: z.string().min(1, 'Informe seu nome').optional(),
  type: z.enum(['DELIVERY', 'PICKUP', 'TABLE']),
  paymentMethod: z.enum(['PIX', 'CASH_ON_DELIVERY']),
  notes: z.string().optional(),
  couponCode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  scheduleOrder: z.boolean().optional(),
  scheduledFor: z.string().optional(),
}).refine(data => {
  if (data.type === 'DELIVERY') {
    return !!data.street && !!data.number && !!data.neighborhood && !!data.city
  }
  return true
}, { message: 'Preencha o endereço completo para entrega', path: ['street'] }).refine(data => {
  if (data.scheduleOrder && data.scheduledFor) {
    const chosen = new Date(data.scheduledFor)
    return chosen >= minScheduledAt()
  }
  return true
}, { message: 'O agendamento deve ser com pelo menos 30 minutos de antecedência', path: ['scheduledFor'] })

type CheckoutForm = z.infer<typeof checkoutSchema>

export function CheckoutPage() {
  const slug = useStoreSlug()
  const navigate = useNavigate()
  const { data: menu } = useMenu(slug)
  const items = useCartStore(s => s.items)
  const subtotal = useCartStore(s => s.subtotal)
  const clearCart = useCartStore(s => s.clearCart)
  const updateQty = useCartStore(s => s.updateQty)
  const removeItem = useCartStore(s => s.removeItem)
  const tableNumber = useCartStore(s => s.tableNumber)
  const mutation = useCreateOrder(slug ?? '')

  const { register, handleSubmit, watch, formState: { errors } } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    // C-022: se entrou via QR de mesa, força type=TABLE
    defaultValues: { type: tableNumber ? 'TABLE' : 'DELIVERY', paymentMethod: 'PIX', scheduleOrder: false },
  })

  const orderType = watch('type')
  const paymentMethod = watch('paymentMethod')
  const scheduleOrder = watch('scheduleOrder')
  const [couponError, setCouponError] = useState('')

  const onSubmit = async (form: CheckoutForm) => {
    setCouponError('')
    const dto = {
      clientWhatsapp: form.clientWhatsapp,
      clientName: form.clientName,
      type: form.type,
      paymentMethod: form.paymentMethod,
      notes: form.notes,
      couponCode: form.couponCode || undefined,
      scheduledFor:
        form.scheduleOrder && form.scheduledFor
          ? new Date(form.scheduledFor).toISOString()
          : undefined,
      address: form.type === 'DELIVERY' ? {
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
    }

    try {
      const result = await mutation.mutateAsync(dto)
      clearCart()
      navigate(`/pedido/${result.token}`, { state: result })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao criar pedido'
      if (msg.includes('Cupom')) setCouponError(msg)
    }
  }

  // Loja suspensa — bloqueia o checkout (Option B). O backend também rejeita
  // o POST /menu/:slug/orders com 422, mas a tela aqui evita confusão antes.
  if (menu?.store.storeStatus === 'suspended') {
    return <SuspendedStorePage storeName={menu.store.name} />
  }

  if (items.length === 0) {
    navigate('/')
    return null
  }

  const store = menu?.store

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto overflow-x-hidden">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Finalizar pedido</h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-4 space-y-5 pb-32">

        {/* Tipo de pedido */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><ShoppingBag size={18} /> Como receber?</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              ...(store?.allowDelivery !== false ? [{ value: 'DELIVERY', label: '🛵 Entrega' }] : []),
              ...(store?.allowPickup ? [{ value: 'PICKUP', label: '🏪 Retirada' }] : []),
            ].map(opt => (
              <label key={opt.value} className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer min-h-[44px] font-medium text-sm transition-colors ${orderType === opt.value ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}>
                <input type="radio" value={opt.value} {...register('type')} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </div>
        </section>

        {/* Identificação */}
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="font-bold text-gray-800 mb-1">Seus dados</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">WhatsApp (com DDD) *</label>
            <input
              type="tel"
              placeholder="11999999999"
              {...register('clientWhatsapp')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              style={{ fontSize: 16 }}
              maxLength={11}
            />
            {errors.clientWhatsapp && <p className="text-red-500 text-xs mt-1">{errors.clientWhatsapp.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Nome</label>
            <input
              type="text"
              placeholder="Seu nome"
              {...register('clientName')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              style={{ fontSize: 16 }}
            />
          </div>
        </section>

        {/* Endereço (apenas DELIVERY) */}
        {orderType === 'DELIVERY' && (
          <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><MapPin size={18} /> Endereço de entrega</h2>
            {[
              { name: 'street', label: 'Rua *', placeholder: 'Nome da rua' },
              { name: 'number', label: 'Número *', placeholder: '123' },
              { name: 'complement', label: 'Complemento', placeholder: 'Apto, bloco...' },
              { name: 'neighborhood', label: 'Bairro *', placeholder: 'Nome do bairro' },
              { name: 'city', label: 'Cidade *', placeholder: 'Nome da cidade' },
            ].map(f => (
              <div key={f.name}>
                <label className="text-sm font-medium text-gray-700 block mb-1">{f.label}</label>
                <input
                  type="text"
                  placeholder={f.placeholder}
                  {...register(f.name as keyof CheckoutForm)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
                  style={{ fontSize: 16 }}
                />
              </div>
            ))}
            {errors.street && <p className="text-red-500 text-xs">{errors.street.message}</p>}
          </section>
        )}

        {/* Retirada */}
        {orderType === 'PICKUP' && store?.address && (
          <section className="bg-blue-50 rounded-xl p-4">
            <p className="text-sm text-blue-700 font-medium">📍 Retire em: {store.address}</p>
            <p className="text-xs text-blue-500 mt-1">Taxa de entrega: grátis</p>
          </section>
        )}

        {/* Pagamento */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><CreditCard size={18} /> Forma de pagamento</h2>
          <div className="space-y-2">
            {store?.features?.allowPix !== false && store?.pixKey && (
              <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer min-h-[44px] transition-colors ${paymentMethod === 'PIX' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                <input type="radio" value="PIX" {...register('paymentMethod')} className="accent-green-500" />
                <span className="font-medium text-sm">💰 Pix</span>
              </label>
            )}
            {store?.allowCashOnDelivery && orderType === 'DELIVERY' && (
              <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer min-h-[44px] transition-colors ${paymentMethod === 'CASH_ON_DELIVERY' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                <input type="radio" value="CASH_ON_DELIVERY" {...register('paymentMethod')} className="accent-green-500" />
                <span className="font-medium text-sm">💵 Pagar na entrega</span>
              </label>
            )}
          </div>

          {/* Pix info */}
          {paymentMethod === 'PIX' && store?.features?.allowPix !== false && store?.pixKey && (
            <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
              <p className="font-semibold">Chave Pix: {store.pixKeyType}</p>
              <p className="font-mono mt-1 break-all">{store.pixKey}</p>
              <p className="mt-1 text-xs">Após o pedido, envie o comprovante via WhatsApp.</p>
            </div>
          )}
        </section>

        {/* Cupom */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-2">Cupom de desconto</h2>
          <input
            type="text"
            placeholder="Código do cupom"
            {...register('couponCode')}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base uppercase focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ fontSize: 16 }}
          />
          {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
        </section>

        {/* Observações */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-2">Observações gerais</h2>
          <textarea
            {...register('notes')}
            placeholder="Alguma observação para o pedido?"
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ fontSize: 16 }}
          />
        </section>

        {/* Agendamento (apenas para pedidos não-mesa) */}
        {(orderType as string) !== 'TABLE' && (
          <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <CalendarClock size={18} /> Agendamento
            </h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('scheduleOrder')}
                className="h-4 w-4 rounded border-gray-300 accent-green-500 cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-700">
                Agendar para outro horário
              </span>
            </label>
            {scheduleOrder && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data e hora do pedido
                </label>
                <input
                  type="datetime-local"
                  {...register('scheduledFor')}
                  min={toDatetimeLocalValue(minScheduledAt())}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
                  style={{ fontSize: 16 }}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Mínimo 30 minutos a partir de agora
                </p>
                {errors.scheduledFor && (
                  <p className="text-red-500 text-xs mt-1">{errors.scheduledFor.message}</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Resumo */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-3">Resumo do pedido</h2>
          <ul className="space-y-2">
            {items.map(item => {
              const base = item.variationPrice ?? item.unitPrice
              const adds = item.additionals.reduce((s, a) => s + a.price, 0)
              const unit = base + adds
              const lineTotal = unit * item.quantity
              const title = item.variationName
                ? `${item.productName} (${item.variationName})`
                : item.productName
              return (
                <li
                  key={item.id}
                  data-testid={`cart-item-${item.id}`}
                  className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg"
                >
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
                    {item.additionals.length > 0 && (
                      <p className="text-xs text-gray-500 truncate">
                        + {item.additionals.map((a) => a.name).join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-gray-400 truncate">Obs: {item.notes}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="inline-flex items-center border border-gray-200 rounded-full">
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
                      <span className="text-sm font-semibold text-gray-900">
                        {lineTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
          <div className="border-t mt-3 pt-3 flex justify-between font-bold text-base">
            <span>Total</span>
            <span>{subtotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </section>
      </form>

      {/* Footer fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 max-w-lg mx-auto">
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={handleSubmit(onSubmit)}
          className="w-full bg-green-500 disabled:bg-green-300 text-white py-3 rounded-xl font-bold text-base min-h-[44px]"
        >
          {mutation.isPending ? 'Enviando...' : `Confirmar pedido • ${subtotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
        </button>
        {mutation.error && (
          <p className="text-red-500 text-xs text-center mt-2">
            {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao criar pedido'}
          </p>
        )}
      </div>
    </div>
  )
}
