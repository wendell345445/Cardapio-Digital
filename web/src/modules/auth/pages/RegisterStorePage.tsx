import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { PasswordInput } from '../../../shared/components/PasswordInput'
import { maskCep, maskWhatsapp, onlyDigits } from '../../../shared/lib/masks'
import { BENEFITS } from '../constants/benefits'
import { BR_STATES } from '../constants/location'
import { SEGMENT_OPTIONS } from '../constants/segments'
import { useRegisterStore } from '../hooks/useRegisterStore'
import { useViaCep } from '../hooks/useViaCep'

const STATE_VALUES = BR_STATES.map((s) => s.value) as [string, ...string[]]
const SEGMENT_VALUES = SEGMENT_OPTIONS.map((s) => s.value) as [string, ...string[]]

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

const registerStoreFormSchema = z
  .object({
    storeName: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
    whatsapp: z
      .string()
      .min(1, 'WhatsApp obrigatório')
      .refine((v) => onlyDigits(v).length === 11, 'WhatsApp deve ter 11 dígitos'),
    segment: z.enum(SEGMENT_VALUES, { errorMap: () => ({ message: 'Selecione um segmento' }) }),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirme a senha'),
    cep: z.string().refine((v) => onlyDigits(v).length === 8, 'CEP deve ter 8 dígitos'),
    street: z.string().min(2, 'Rua obrigatória').max(120),
    number: z.string().min(1, 'Número obrigatório').max(10),
    neighborhood: z.string().min(2, 'Bairro obrigatório').max(80),
    city: z.string().min(2, 'Cidade obrigatória').max(80),
    state: z.enum(STATE_VALUES, { errorMap: () => ({ message: 'UF obrigatória' }) }),
    plan: z.enum(['PROFESSIONAL', 'PREMIUM']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

type RegisterStoreFormValues = z.infer<typeof registerStoreFormSchema>

export function RegisterStorePage() {
  const navigate = useNavigate()
  const { lookup: lookupCep } = useViaCep()
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterStoreFormValues>({
    resolver: zodResolver(registerStoreFormSchema),
    mode: 'onBlur',
    defaultValues: { plan: 'PROFESSIONAL' },
  })

  const selectedPlan = watch('plan')

  const cepValue = watch('cep')
  const lastLookedUpCepRef = useRef<string>('')

  // Auto-completa endereço quando CEP tem 8 dígitos.
  // Ref impede re-fetch do mesmo CEP em cada re-render (setValue dispara re-renders e
  // este efeito rodaria de novo com o mesmo cepValue → loop de requests pro ViaCEP).
  useEffect(() => {
    const digits = onlyDigits(cepValue ?? '')
    if (digits.length !== 8) return
    if (digits === lastLookedUpCepRef.current) return

    lastLookedUpCepRef.current = digits
    void lookupCep(digits).then((result) => {
      if (result) {
        if (result.street) setValue('street', result.street, { shouldValidate: false })
        if (result.neighborhood)
          setValue('neighborhood', result.neighborhood, { shouldValidate: false })
        if (result.city) setValue('city', result.city, { shouldValidate: false })
        if (result.state) setValue('state', result.state, { shouldValidate: false })
      }
    })
  }, [cepValue, lookupCep, setValue])

  const { register: submitRegister, isLoading, error } = useRegisterStore({
    onSuccess: () => {
      void navigate('/dashboard', { replace: true })
    },
    onError: (err) => {
      if (err.kind === 'EMAIL_DUPLICATE') {
        setError('email', { type: 'manual', message: 'Email já cadastrado' })
      } else if (err.kind === 'PASSWORD_MISMATCH') {
        setError('confirmPassword', { type: 'manual', message: 'As senhas não coincidem' })
      }
    },
  })

  const onSubmit = (values: RegisterStoreFormValues) => {
    submitRegister({
      storeName: values.storeName,
      segment: values.segment,
      email: values.email,
      password: values.password,
      confirmPassword: values.confirmPassword,
      whatsapp: onlyDigits(values.whatsapp),
      cep: onlyDigits(values.cep),
      street: values.street,
      number: values.number,
      neighborhood: values.neighborhood,
      city: values.city,
      state: values.state,
      plan: values.plan,
    })
  }

  const submitting = isLoading || isSubmitting

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-primary/5 px-4 py-4">
      <div className="grid w-full max-w-5xl grid-cols-1 gap-3 lg:grid-cols-5 lg:gap-4">
        {/* Coluna esquerda — Landing (2/5) */}
        <aside className="lg:col-span-2">
          <div className="flex h-full flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <img
              src="/logo.png"
              alt="Menu Panda"
              className="mb-4 h-[7.5rem] w-auto object-contain"
            />
            <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900">
              Teste 100% grátis
            </h1>
            <p className="mt-1 text-xs text-gray-600">
              Sem cartão de crédito. Todas as funções por 7 dias.
            </p>

            <ul className="mt-3 space-y-1.5">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-[11px] text-gray-700">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                  <span className="leading-snug">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Coluna direita — Formulário (3/5) */}
        <section className="lg:col-span-3">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <header className="mb-3">
              <h2 className="text-lg font-bold tracking-tight text-gray-900">Crie sua loja</h2>
              <p className="mt-0.5 text-[11px] text-gray-600">
                Comece seu teste grátis agora — 7 dias sem cartão
              </p>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-2.5">
              {/* Seletor de planos — cards compactos lado a lado */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Escolha seu plano · 7 dias grátis sem cartão
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

              {/* Linha 1: Nome da loja + Segmento */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Nome da loja" htmlFor="storeName" error={errors.storeName?.message}>
                  <input
                    id="storeName"
                    type="text"
                    autoComplete="organization"
                    disabled={submitting}
                    className={inputClass}
                    {...register('storeName')}
                  />
                </Field>

                <Field label="Segmento" htmlFor="segment" error={errors.segment?.message}>
                  <select
                    id="segment"
                    disabled={submitting}
                    className={inputClass}
                    defaultValue=""
                    {...register('segment')}
                  >
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {SEGMENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Linha 2: WhatsApp + E-mail */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="WhatsApp" htmlFor="whatsapp" error={errors.whatsapp?.message}>
                  <input
                    id="whatsapp"
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

                <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    disabled={submitting}
                    className={inputClass}
                    {...register('email')}
                  />
                </Field>
              </div>

              {/* Linha 3: Senha + Confirmar senha */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Senha" htmlFor="password" error={errors.password?.message}>
                  <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    disabled={submitting}
                    className={inputClass}
                    {...register('password')}
                  />
                </Field>

                <Field label="Confirmar senha" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
                  <PasswordInput
                    id="confirmPassword"
                    autoComplete="new-password"
                    disabled={submitting}
                    className={inputClass}
                    {...register('confirmPassword')}
                  />
                </Field>
              </div>

              {/* Divider compacto — Endereço */}
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                  Endereço
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* Linha 4: CEP + Rua + Número (grid 6) */}
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-2">
                  <Field label="CEP" htmlFor="cep" error={errors.cep?.message}>
                    <input
                      id="cep"
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="00000-000"
                      disabled={submitting}
                      className={inputClass}
                      {...register('cep', {
                        onChange: (e) => {
                          e.target.value = maskCep(e.target.value)
                        },
                      })}
                    />
                  </Field>
                </div>
                <div className="col-span-3">
                  <Field label="Rua / Logradouro" htmlFor="street" error={errors.street?.message}>
                    <input
                      id="street"
                      type="text"
                      autoComplete="address-line1"
                      disabled={submitting}
                      className={inputClass}
                      {...register('street')}
                    />
                  </Field>
                </div>
                <div className="col-span-1">
                  <Field label="Nº" htmlFor="number" error={errors.number?.message}>
                    <input
                      id="number"
                      type="text"
                      disabled={submitting}
                      className={inputClass}
                      {...register('number')}
                    />
                  </Field>
                </div>
              </div>

              {/* Linha 5: Bairro + Cidade + UF (grid 6) */}
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-2">
                  <Field label="Bairro" htmlFor="neighborhood" error={errors.neighborhood?.message}>
                    <input
                      id="neighborhood"
                      type="text"
                      autoComplete="address-level3"
                      disabled={submitting}
                      className={inputClass}
                      {...register('neighborhood')}
                    />
                  </Field>
                </div>
                <div className="col-span-3">
                  <Field label="Cidade" htmlFor="city" error={errors.city?.message}>
                    <input
                      id="city"
                      type="text"
                      autoComplete="address-level2"
                      disabled={submitting}
                      className={inputClass}
                      {...register('city')}
                    />
                  </Field>
                </div>
                <div className="col-span-1">
                  <Field label="UF" htmlFor="state" error={errors.state?.message}>
                    <select
                      id="state"
                      disabled={submitting}
                      className={inputClass}
                      defaultValue=""
                      {...register('state')}
                    >
                      <option value="" disabled>
                        —
                      </option>
                      {BR_STATES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.value}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              {error && error.kind === 'RATE_LIMIT' && (
                <div
                  role="alert"
                  className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800"
                >
                  {error.message}
                </div>
              )}

              {error && error.kind === 'GENERIC' && (
                <div
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                >
                  {error.message}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
                className="mt-1 flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 transition-colors"
              >
                {submitting && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                {submitting ? 'Criando sua loja...' : 'Criar minha loja grátis'}
              </button>

              <p className="text-center text-[11px] text-gray-500">
                Já tem conta?{' '}
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  Entrar
                </Link>
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}

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
