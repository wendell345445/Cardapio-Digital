import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useCartStore } from '../store/useCartStore'
import { useMenu } from '../hooks/useMenu'
import { useTableMode } from '../hooks/useTableMode'
import { useCreateOrder } from '../hooks/useOrder'
import { saveAddress } from '../lib/customerAddresses'
import { saveCustomerName } from '../lib/customerName'
import { getCustomerSessionId } from '../lib/customerSession'
import { getCustomerWhatsapp } from '../lib/customerWhatsapp'
import { ThemeInjector } from '../components/ThemeInjector'
import { PageHeader } from '../components/PageHeader'

import type { CheckoutNavState } from './CheckoutPage'

import { useStoreSlug } from '@/hooks/useStoreSlug'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type PaymentMethodId =
  | 'PIX'
  | 'PIX_ON_DELIVERY'
  | 'CASH_ON_DELIVERY'
  | 'CREDIT_ON_DELIVERY'
  | 'DEBIT_ON_DELIVERY'

interface PaymentOption {
  id: PaymentMethodId
  label: string
  description: string
  iconSrc: string
  iconAlt: string
}

// Ícones flat-style coloridos hospedados no CDN do Anima — mesmos do
// protótipo MenuPanda pra manter identidade visual consistente.
const ICON_DINHEIRO = 'https://c.animaapp.com/lguJ4fGV/img/money2-1.svg'
const ICON_PIX = 'https://c.animaapp.com/lguJ4fGV/img/icons8-foto--1--1.svg'
const ICON_CREDITO = 'https://c.animaapp.com/lguJ4fGV/img/credit-card-1.svg'
const ICON_DEBITO = 'https://c.animaapp.com/lguJ4fGV/img/credit-card-1-1.svg'

const ALL_OPTIONS: PaymentOption[] = [
  {
    id: 'PIX',
    label: 'Pix',
    description: 'Enviar comprovante para loja',
    iconSrc: ICON_PIX,
    iconAlt: 'Ícone do Pix',
  },
  {
    id: 'PIX_ON_DELIVERY',
    label: 'Pix na entrega',
    description: 'Pague pelo Pix ao receber',
    iconSrc: ICON_PIX,
    iconAlt: 'Ícone do Pix',
  },
  {
    id: 'CASH_ON_DELIVERY',
    label: 'Dinheiro',
    description: 'Pague na entrega',
    iconSrc: ICON_DINHEIRO,
    iconAlt: 'Ícone de dinheiro',
  },
  {
    id: 'CREDIT_ON_DELIVERY',
    label: 'Crédito',
    description: 'Cartão na entrega',
    iconSrc: ICON_CREDITO,
    iconAlt: 'Ícone de cartão de crédito',
  },
  {
    id: 'DEBIT_ON_DELIVERY',
    label: 'Débito',
    description: 'Cartão na entrega',
    iconSrc: ICON_DEBITO,
    iconAlt: 'Ícone de cartão de débito',
  },
]

export function PagamentoPage() {
  const slug = useStoreSlug()
  const navigate = useNavigate()
  const location = useLocation()
  const navState = (location.state ?? null) as CheckoutNavState | null

  const { data: menu } = useMenu(slug)
  const items = useCartStore((s) => s.items)
  const subtotal = useCartStore((s) => s.subtotal)
  const clearCart = useCartStore((s) => s.clearCart)
  const { tableNumber, tableSessionToken, deviceName } = useTableMode()
  const mutation = useCreateOrder(slug ?? '')

  const inTableMode = !!tableNumber

  const [selectedPayment, setSelectedPayment] = useState<PaymentMethodId | null>(null)
  const [showCashSheet, setShowCashSheet] = useState(false)
  const [cashChangeFor, setCashChangeFor] = useState('')
  const [cashNeedsChange, setCashNeedsChange] = useState(true)

  // Sem state da tela anterior (entrou direto na URL) e sem mesa = volta pro carrinho.
  // IMPORTANTE: não redireciona quando o pedido acabou de ser submetido com
  // sucesso. O submit chama clearCart() (items=0) e depois navega pra
  // /pedido/<token>. Sem o guard `mutation.isSuccess`, este effect dispararia
  // primeiro e sobrescreveria o navigate pro tracking, voltando pra home.
  useEffect(() => {
    if (mutation.isSuccess) return
    if (!navState && !inTableMode) {
      navigate('/carrinho', { replace: true })
    } else if (items.length === 0) {
      navigate('/', { replace: true })
    }
  }, [navState, inTableMode, items.length, navigate, mutation.isSuccess])

  const store = menu?.store

  // Filtra métodos por features da loja + tipo de pedido.
  const isDelivery = navState?.deliveryMethod === 'endereco'
  const allowPix = store?.features?.allowPix === true && !!store?.pixKey
  const availableOptions: PaymentOption[] = ALL_OPTIONS.filter((opt) => {
    if (opt.id === 'PIX') {
      // Pix online: precisa só ter chave Pix configurada (vale pra delivery e
      // retirada — cliente paga online antes do pedido sair).
      return allowPix
    }
    // Demais métodos só fazem sentido em DELIVERY (na entrega).
    if (!isDelivery) return false
    if (opt.id === 'PIX_ON_DELIVERY') return allowPix && !!store?.allowCashOnDelivery
    if (opt.id === 'CASH_ON_DELIVERY') return !!store?.allowCashOnDelivery
    // Crédito/Débito reusam a flag de pagamento na entrega da loja.
    return !!store?.allowCashOnDelivery
  })

  const subtotalValue = subtotal()
  const total = subtotalValue // taxa entrega calculada no backend; cupom aplicado na próxima

  const handleBack = () => {
    if (window.history.length > 1) window.history.back()
    else navigate('/checkout')
  }

  const handleSelect = (id: PaymentMethodId) => {
    setSelectedPayment(id)
    if (id === 'CASH_ON_DELIVERY') setShowCashSheet(true)
  }

  const handleSubmit = async () => {
    if (mutation.isPending) return
    if (!inTableMode && !selectedPayment) return

    // Em mesa: PENDING. Fora de mesa: o que cliente escolheu.
    const paymentMethod: PaymentMethodId | 'PENDING' = inTableMode ? 'PENDING' : selectedPayment!

    // Anexa "Troco para R$ X" nas observações se for dinheiro.
    let finalNotes = navState?.notes ?? ''
    if (selectedPayment === 'CASH_ON_DELIVERY') {
      const noteParts = [finalNotes, cashNeedsChange && cashChangeFor ? `Troco para R$ ${cashChangeFor}` : !cashNeedsChange ? 'Não precisa de troco' : '']
        .filter(Boolean)
      finalNotes = noteParts.join('\n')
    }

    const dto = {
      clientName: navState?.clientName ?? deviceName?.trim() ?? 'Convidado',
      // WhatsApp informado no /identifique-se (persistido em localStorage).
      // Vazio quando o cliente entrou direto no fluxo de mesa, sem se identificar.
      clientWhatsapp: getCustomerWhatsapp() || undefined,
      customerSessionId: getCustomerSessionId(),
      type: inTableMode
        ? ('TABLE' as const)
        : navState?.deliveryMethod === 'endereco'
          ? ('DELIVERY' as const)
          : ('PICKUP' as const),
      paymentMethod,
      notes: finalNotes || undefined,
      couponCode: navState?.couponCode,
      address: navState?.address,
      deliveryNeighborhoodId: navState?.deliveryNeighborhoodId,
      tableSessionToken: inTableMode && tableSessionToken ? tableSessionToken : undefined,
      deviceName: inTableMode && deviceName ? deviceName : undefined,
      items: items.map((i) => ({
        productId: i.productId,
        variationId: i.variationId,
        quantity: i.quantity,
        notes: i.notes,
        // v2.9: ids são de Addon (catálogo de adicionais), não mais ProductAdditional.
        // Cart guarda a referência em `additionals[].id` (snapshot do Addon.id no momento do "adicionar").
        addonIds: i.additionals.map((a) => a.id),
      })),
    }

    try {
      const result = await mutation.mutateAsync(dto)
      saveCustomerName(dto.clientName)
      if (dto.address) {
        saveAddress({
          street: dto.address.street,
          number: dto.address.number,
          complement: dto.address.complement,
          neighborhood: dto.address.neighborhood ?? '',
          city: dto.address.city ?? '',
          state: dto.address.state,
          zipCode: dto.address.zipCode,
        })
      }
      clearCart()
      const isPixOnline = !!result.pixCopyPaste
      navigate(isPixOnline ? `/pedido/${result.token}/pix` : `/pedido/${result.token}`, {
        state: result,
      })
    } catch {
      // erro já fica em mutation.error e renderiza no rodapé
    }
  }

  // Em mesa, pulamos a escolha de método (vai automático com PENDING).
  // Mas mantemos a tela com botão "Confirmar" pra revisar antes do submit.
  const canSubmit = inTableMode || !!selectedPayment
  const selectedOption = availableOptions.find((o) => o.id === selectedPayment)

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-menu-bg [font-family:'Sen',Helvetica] antialiased text-menu-text">
      <ThemeInjector
        primaryColor={menu?.store.primaryColor}
        secondaryColor={menu?.store.secondaryColor}
      />
      <div className="mx-auto flex min-h-dvh w-full max-w-[768px] flex-col bg-menu-bg px-4 sm:px-6 md:px-8">
        <PageHeader title="Pagamento" onBack={handleBack} />

        <main
          className="flex flex-1 flex-col pt-5"
          style={{ paddingBottom: 'calc(140px + env(safe-area-inset-bottom))' }}
        >
          <section aria-labelledby="payment-methods-heading">
            <div className="max-w-[330px]">
              <h2
                id="payment-methods-heading"
                className="text-[23px] font-semibold leading-[1.17] tracking-[-0.45px] text-menu-text"
              >
                {inTableMode ? 'Confira seu pedido' : 'Qual tipo de pagamento deseja usar?'}
              </h2>
              <p className="mt-2 max-w-[295px] text-[13px] font-normal leading-[18px] tracking-[-0.2px] text-[#817777]">
                {inTableMode
                  ? 'O pagamento será realizado ao fechar a comanda.'
                  : 'Escolha a forma de pagamento para continuar com a finalização do seu pedido.'}
              </p>
            </div>

            {!inTableMode && (
              <div className="mt-8 flex flex-col gap-5">
                {/* Online: pagamento confirmado antes do pedido sair. */}
                {(() => {
                  const onlineOpts = availableOptions.filter((o) => o.id === 'PIX')
                  if (onlineOpts.length === 0) return null
                  return (
                    <div className="flex flex-col gap-2">
                      <SectionHeader label="Pagamento online" />
                      <div className="flex flex-col gap-2">
                        {onlineOpts.map((opt) => (
                          <PaymentRow
                            key={opt.id}
                            opt={opt}
                            isSelected={selectedPayment === opt.id}
                            onSelect={() => handleSelect(opt.id)}
                            cashNeedsChange={cashNeedsChange}
                            cashChangeFor={cashChangeFor}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Na entrega: cliente paga ao receber o pedido. */}
                {(() => {
                  const deliveryOpts = availableOptions.filter((o) => o.id !== 'PIX')
                  if (deliveryOpts.length === 0) return null
                  return (
                    <div className="flex flex-col gap-2">
                      <SectionHeader label="Pagamento na entrega" />
                      <div className="flex flex-col gap-2">
                        {deliveryOpts.map((opt) => (
                          <PaymentRow
                            key={opt.id}
                            opt={opt}
                            isSelected={selectedPayment === opt.id}
                            onSelect={() => handleSelect(opt.id)}
                            cashNeedsChange={cashNeedsChange}
                            cashChangeFor={cashChangeFor}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {availableOptions.length === 0 && (
                  <p className="rounded-[14px] bg-yellow-50 px-4 py-3 text-[12px] text-yellow-800">
                    Nenhuma forma de pagamento disponível para este pedido.
                  </p>
                )}
              </div>
            )}
          </section>

        </main>

        {/* Resumo + botão Continuar — fixo no rodapé */}
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-menu-card-border bg-white shadow-[0_-4px_16px_rgba(64,57,57,0.06)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <section
            className="mx-auto w-full max-w-[768px] px-4 py-3 sm:px-6 md:px-8"
            aria-label="Resumo do pagamento"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="block text-[11px] font-normal leading-none tracking-[-0.15px] text-menu-text-soft">
                  {inTableMode ? 'Total do pedido' : 'Método selecionado'}
                </span>
                <strong className="mt-1.5 block text-[15px] font-semibold leading-none text-menu-text">
                  {inTableMode
                    ? fmt(total)
                    : selectedOption?.label ?? 'Escolha um método'}
                </strong>
                {selectedPayment === 'CASH_ON_DELIVERY' && (
                  <span className="mt-1.5 block text-[11px] font-normal leading-none tracking-[-0.15px] text-menu-text-soft">
                    {!cashNeedsChange
                      ? 'Não precisa de troco'
                      : cashChangeFor
                        ? `Troco para R$ ${cashChangeFor}`
                        : 'Informe o troco'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || mutation.isPending || availableOptions.length === 0 && !inTableMode}
                className={`flex h-[42px] shrink-0 items-center justify-center rounded-full px-5 text-[13px] font-semibold transition-transform active:scale-[0.98] ${
                  canSubmit && !mutation.isPending
                    ? 'bg-menu-primary text-white shadow-menu-lg'
                    : 'bg-[#f0eaea] text-[#9b9292]'
                }`}
              >
                {mutation.isPending
                  ? 'Enviando…'
                  : inTableMode
                    ? 'Confirmar pedido'
                    : 'Finalizar Pedido'}
              </button>
            </div>

            {mutation.error && (() => {
              const err = mutation.error as {
                response?: {
                  data?: {
                    error?: string
                    message?: string
                    details?: Array<{ path: (string | number)[]; message: string }>
                  }
                }
              }
              const baseMsg =
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                'Erro ao criar pedido'
              const details = err?.response?.data?.details
              const detailMsg = Array.isArray(details)
                ? details.map((d) => `${d.path.join('.')}: ${d.message}`).join('; ')
                : ''
              return (
                <p className="mt-3 text-center text-[12px] text-menu-primary">
                  {baseMsg}
                  {detailMsg ? ` — ${detailMsg}` : ''}
                </p>
              )
            })()}
          </section>
        </div>
      </div>

      {showCashSheet && (
        <CashChangeBottomSheet
          value={cashChangeFor}
          needsChange={cashNeedsChange}
          onChange={(v) => {
            setCashChangeFor(v)
            setCashNeedsChange(true)
          }}
          onToggleNoChange={() => {
            setCashChangeFor('')
            setCashNeedsChange((c) => !c)
          }}
          onClose={() => setShowCashSheet(false)}
        />
      )}
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] font-semibold uppercase tracking-[1px] text-menu-text-soft">
        {label}
      </span>
      <span className="h-px flex-1 bg-menu-divider" />
    </div>
  )
}

function PaymentRow({
  opt,
  isSelected,
  onSelect,
  cashNeedsChange,
  cashChangeFor,
}: {
  opt: PaymentOption
  isSelected: boolean
  onSelect: () => void
  cashNeedsChange: boolean
  cashChangeFor: string
}) {
  const isDinheiroSelected = opt.id === 'CASH_ON_DELIVERY' && isSelected
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onSelect}
      className={`group relative flex min-h-[64px] w-full items-center gap-3 rounded-[18px] bg-white px-4 text-left shadow-[0_4px_16px_rgba(64,57,57,0.055)] transition-all duration-200 active:scale-[0.99] ${
        isSelected ? 'ring-1 ring-menu-primary/30' : 'ring-1 ring-[#403939]/8'
      }`}
    >
      <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] bg-[#f7f3f3]">
        <img className="h-[24px] w-[24px] object-contain" src={opt.iconSrc} alt={opt.iconAlt} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-none tracking-[-0.2px] text-menu-text">
          {opt.label}
        </span>
        <span className="mt-1.5 block text-[11px] font-normal leading-none tracking-[-0.15px] text-menu-text-soft">
          {isDinheiroSelected && !cashNeedsChange
            ? 'Não precisa de troco'
            : isDinheiroSelected && cashChangeFor
              ? `Troco para R$ ${cashChangeFor}`
              : opt.description}
        </span>
      </span>
      <span
        className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full transition-colors ${
          isSelected ? 'bg-menu-primary' : 'bg-[#f4eeee]'
        }`}
      >
        {isSelected ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M3.1 7.3L5.7 9.8L10.9 4.2"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 6L15 12L9 18"
              stroke="#9a8f8f"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  )
}

function CashChangeBottomSheet({
  value,
  needsChange,
  onChange,
  onToggleNoChange,
  onClose,
}: {
  value: string
  needsChange: boolean
  onChange: (v: string) => void
  onToggleNoChange: () => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-3"
      style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
      role="dialog"
      aria-modal="true"
      aria-label="Troco para o pagamento"
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />

      <section
        className="relative z-[81] w-full max-w-[420px] overflow-hidden rounded-[22px] bg-white p-4 shadow-[0_16px_44px_rgba(0,0,0,0.24)]"
        style={{ border: '0.6px solid rgba(255, 255, 255, 0.55)' }}
      >
        <h2 className="text-center text-[16px] font-semibold tracking-[-0.2px] text-menu-text">
          Precisa de troco?
        </h2>
        <p className="mt-2 text-center text-[12px] text-menu-text-soft">
          Informe o valor que você vai pagar pra entregadora levar o troco certo.
        </p>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12px] font-semibold text-menu-text">
            Troco para R$
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ''))}
            placeholder="50,00"
            disabled={!needsChange}
            className="h-[46px] w-full rounded-[14px] bg-[#faf8f8] px-3 text-[14px] font-semibold text-menu-text outline-none placeholder:font-normal placeholder:text-[#aaa0a0] disabled:opacity-50"
            style={{ border: '0.6px solid rgba(65, 57, 57, 0.13)', fontSize: 16 }}
          />
        </label>

        <label className="mt-3 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={!needsChange}
            onChange={onToggleNoChange}
            className="h-4 w-4 cursor-pointer accent-menu-primary"
          />
          <span className="text-[13px] text-menu-text">Não preciso de troco</span>
        </label>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 flex h-[44px] w-full items-center justify-center rounded-full bg-menu-primary px-4 text-[14px] font-bold text-white shadow-menu-md active:scale-[0.99]"
        >
          Confirmar
        </button>
      </section>
    </div>
  )
}
