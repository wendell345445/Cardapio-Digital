import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { z } from 'zod'

import { maskWhatsapp, onlyDigits } from '../../../shared/lib/masks'

// ─── Plan cards ──────────────────────────────────────────────────────────────

type PlanId = 'PROFESSIONAL' | 'PREMIUM'

interface PlanOption {
  id: PlanId
  name: string
  price: string
  tagline: string
  features: string[]
  highlight?: boolean
}

const PLAN_OPTIONS: PlanOption[] = [
  {
    id: 'PROFESSIONAL',
    name: 'Profissional',
    price: 'R$ 99',
    tagline: 'WhatsApp',
    features: [
      'Cardápio digital ilimitado',
      'Pedidos via WhatsApp',
      'Pagamento Pix',
      'Painel admin completo',
    ],
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    price: 'R$ 149',
    tagline: 'WhatsApp + IA',
    highlight: true,
    features: [
      'Tudo do Profissional',
      'Atendimento IA no WhatsApp',
      'Cupons e analytics',
      'Entrega por zonas/raio',
    ],
  },
]

// ─── Schema ──────────────────────────────────────────────────────────────────

const createStoreSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  slug: z
    .string()
    .min(2, 'Slug obrigatório')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Apenas letras minúsculas, números e hífens'),
  plan: z.enum(['PROFESSIONAL', 'PREMIUM']),
  adminEmail: z.string().email('Email inválido'),
  adminName: z.string().min(2, 'Nome do admin obrigatório'),
  whatsapp: z
    .string()
    .min(1, 'WhatsApp obrigatório')
    .refine((v) => onlyDigits(v).length === 11, 'WhatsApp deve ter 11 dígitos'),
  whatsappMode: z.enum(['WHATSAPP', 'WHATSAPP_AI']).default('WHATSAPP'),
}).refine(
  (data) => !(data.whatsappMode === 'WHATSAPP_AI' && data.plan !== 'PREMIUM'),
  { message: 'WhatsApp com IA requer o plano Premium', path: ['whatsappMode'] }
)

type StoreFormValues = z.infer<typeof createStoreSchema>

export interface CreateStoreFormData {
  name: string
  slug: string
  plan: PlanId
  adminEmail: string
  adminName: string
  whatsapp: string
  whatsappMode: 'WHATSAPP' | 'WHATSAPP_AI'
}

interface StoreFormProps {
  onSubmit: (data: CreateStoreFormData) => void
  isLoading?: boolean
}

export function StoreForm({ onSubmit, isLoading }: StoreFormProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StoreFormValues>({
    resolver: zodResolver(createStoreSchema),
    mode: 'onBlur',
    defaultValues: { plan: 'PROFESSIONAL', whatsappMode: 'WHATSAPP' },
  })

  const selectedPlan = useWatch({ control, name: 'plan' })
  const submitting = isLoading || isSubmitting

  function handleFormSubmit(values: StoreFormValues) {
    onSubmit({
      ...values,
      whatsapp: onlyDigits(values.whatsapp),
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} noValidate className="space-y-2.5">
      {/* Seletor de planos — cards compactos lado a lado */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Escolha o plano · 7 dias grátis sem cartão
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PLAN_OPTIONS.map((opt) => {
            const isSelected = selectedPlan === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setValue('plan', opt.id, { shouldValidate: true })}
                disabled={submitting}
                aria-pressed={isSelected}
                className={`relative rounded-lg border-2 px-3 py-2 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {opt.highlight && (
                  <span className="absolute -top-1.5 right-2 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-900">
                    Recomendado
                  </span>
                )}
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-900">{opt.name}</h3>
                    <p className="text-[10px] text-gray-500">{opt.tagline}</p>
                  </div>
                  {isSelected && (
                    <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </div>
                <p className="mt-0.5 text-base font-bold text-gray-900 leading-tight">
                  {opt.price}
                  <span className="text-[11px] font-normal text-gray-500">/mês</span>
                </p>
                <ul className="mt-1 space-y-0.5">
                  {opt.features.map((f) => (
                    <li key={f} className="flex items-start gap-1 text-[10px] text-gray-600">
                      <CheckCircle2
                        aria-hidden="true"
                        className="mt-[1px] h-2.5 w-2.5 shrink-0 text-green-600"
                      />
                      <span className="leading-tight">{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
        <input type="hidden" {...register('plan')} />
      </div>

      {/* Linha 1: Nome da loja + Slug */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Nome da loja" htmlFor="ownerStoreName" error={errors.name?.message}>
          <input
            id="ownerStoreName"
            type="text"
            placeholder="Ex: Pizzaria do João"
            disabled={submitting}
            className={inputClass}
            {...register('name')}
          />
        </Field>

        <Field label="Slug (URL)" htmlFor="ownerStoreSlug" error={errors.slug?.message}>
          <input
            id="ownerStoreSlug"
            type="text"
            placeholder="ex: pizzaria-do-joao"
            disabled={submitting}
            className={`${inputClass} font-mono`}
            {...register('slug')}
          />
        </Field>
      </div>

      {/* Linha 2: Nome do Admin + Email do Admin */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Nome do Admin" htmlFor="ownerAdminName" error={errors.adminName?.message}>
          <input
            id="ownerAdminName"
            type="text"
            placeholder="Ex: João Silva"
            disabled={submitting}
            className={inputClass}
            {...register('adminName')}
          />
        </Field>

        <Field label="Email do Admin" htmlFor="ownerAdminEmail" error={errors.adminEmail?.message}>
          <input
            id="ownerAdminEmail"
            type="email"
            autoComplete="email"
            placeholder="admin@loja.com.br"
            disabled={submitting}
            className={inputClass}
            {...register('adminEmail')}
          />
        </Field>
      </div>

      {/* Linha 3: WhatsApp */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="WhatsApp" htmlFor="ownerWhatsapp" error={errors.whatsapp?.message}>
          <input
            id="ownerWhatsapp"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(48) 99999-0000"
            disabled={submitting}
            className={inputClass}
            {...register('whatsapp', {
              onChange: (e) => {
                e.target.value = maskWhatsapp(e.target.value)
              },
            })}
          />
        </Field>
      </div>

      {/* Divider — Modo WhatsApp */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">
          Modo WhatsApp
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* WhatsApp Mode */}
      <div className="space-y-1.5">
        <label
          className={`flex items-start gap-3 rounded-lg border-2 px-3 py-2 transition-all ${
            selectedPlan !== undefined
              ? 'cursor-pointer hover:border-gray-300'
              : ''
          }`}
        >
          <input
            {...register('whatsappMode')}
            type="radio"
            value="WHATSAPP"
            disabled={submitting}
            className="mt-0.5"
          />
          <div>
            <p className="text-xs font-medium text-gray-800">WhatsApp</p>
            <p className="text-[10px] text-gray-500">
              Notificações automáticas de status dos pedidos
            </p>
          </div>
        </label>

        <label
          className={`flex items-start gap-3 rounded-lg border-2 px-3 py-2 transition-all ${
            selectedPlan === 'PREMIUM'
              ? 'cursor-pointer hover:border-gray-300'
              : 'cursor-not-allowed bg-gray-50 opacity-50'
          }`}
        >
          <input
            {...register('whatsappMode')}
            type="radio"
            value="WHATSAPP_AI"
            disabled={submitting || selectedPlan !== 'PREMIUM'}
            className="mt-0.5"
          />
          <div>
            <p className="text-xs font-medium text-gray-800">
              WhatsApp com IA
              <span className="ml-2 rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">
                Premium
              </span>
            </p>
            <p className="text-[10px] text-gray-500">
              Atendimento inteligente via Ollama IA (requer plano Premium)
            </p>
          </div>
        </label>
        {errors.whatsappMode && (
          <p role="alert" className="text-[10px] text-red-600">
            {errors.whatsappMode.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="mt-1 flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 transition-colors"
      >
        {submitting && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
        {submitting ? 'Criando loja...' : 'Criar loja'}
      </button>
    </form>
  )
}

// ─── Shared primitives ───────────────────────────────────────────────────────

const inputClass =
  'block h-8 w-full rounded-md border border-gray-300 bg-white px-2.5 text-xs placeholder-gray-400 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50'

interface FieldProps {
  label: string
  htmlFor: string
  error?: string
  children: React.ReactNode
}

function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div className="space-y-0.5">
      <label htmlFor={htmlFor} className="block text-[11px] font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-[10px] text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
