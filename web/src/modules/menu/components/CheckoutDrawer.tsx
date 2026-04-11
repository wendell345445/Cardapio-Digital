import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, ShoppingBag } from 'lucide-react'

import { useCartStore } from '../store/useCartStore'
import { useMenu } from '../hooks/useMenu'
import { useCreateOrder } from '../hooks/useOrder'

import { useStoreSlug } from '@/hooks/useStoreSlug'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const schema = z.object({
  clientWhatsapp: z.string().length(11, 'Informe 11 dígitos (com DDD)'),
  clientName: z.string().min(1, 'Informe seu nome').optional(),
  type: z.enum(['DELIVERY', 'PICKUP']),
  paymentMethod: z.enum(['PIX', 'CASH_ON_DELIVERY']),
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
  const mutation = useCreateOrder(slug ?? '')

  const [couponError, setCouponError] = useState('')

  const { register, handleSubmit, watch, formState: { errors } } = useForm<CheckoutForm>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'DELIVERY', paymentMethod: 'PIX' },
  })

  const orderType = watch('type')
  const paymentMethod = watch('paymentMethod')
  const store = menu?.store

  const deliveryFee = 0 // TODO: integrate with neighborhoods
  const total = subtotal() + deliveryFee

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
          street: form.street!,
          number: form.number!,
          complement: form.complement,
          neighborhood: form.neighborhood!,
          city: form.city!,
        } : undefined,
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
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao criar pedido'
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
        <div className="flex items-center gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100">
          <div>
            <p className="text-xl font-bold text-gray-900">{fmt(total)}</p>
            <p className="text-xs text-gray-400">{items.length} item(s) no pedido</p>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-5">
            {/* Tipo de entrega */}
            <div className="grid grid-cols-2 gap-2">
              {['DELIVERY', ...(store?.allowPickup ? ['PICKUP'] : [])].map(t => (
                <label
                  key={t}
                  className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer text-sm font-medium transition-colors ${
                    orderType === t
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <input type="radio" value={t} {...register('type')} className="sr-only" />
                  {t === 'DELIVERY' ? '🛵 Entrega' : '🏪 Retirada'}
                </label>
              ))}
            </div>

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
                  <span className="font-medium">💰 Pix</span>
                </label>
              )}
              {store?.allowCashOnDelivery && orderType === 'DELIVERY' && (
                <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer text-sm ${paymentMethod === 'CASH_ON_DELIVERY' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                  <input type="radio" value="CASH_ON_DELIVERY" {...register('paymentMethod')} className="accent-red-500" />
                  <span className="font-medium">💵 Pagar na entrega</span>
                </label>
              )}
              {paymentMethod === 'PIX' && store?.pixKey && (
                <div className="p-3 bg-yellow-50 rounded-lg text-xs text-yellow-800">
                  <p className="font-semibold">Chave Pix ({store.pixKeyType}): {store.pixKey}</p>
                  <p className="mt-0.5">Envie o comprovante via WhatsApp após o pedido.</p>
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
                <span>{paymentMethod === 'PIX' ? 'Pix' : 'Dinheiro'}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-base">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
            </div>

            {mutation.error && (
              <p className="text-red-500 text-xs text-center">
                {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao criar pedido'}
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
