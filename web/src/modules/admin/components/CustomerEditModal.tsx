import { useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Star, Trash2, X } from 'lucide-react'
import { z } from 'zod'


import { BR_STATES } from '../../auth/constants/location'
import { useViaCep } from '../../auth/hooks/useViaCep'
import { useUpdateCustomer } from '../hooks/useAnalytics'
import type { CustomerDetail } from '../services/analytics.service'

import { maskCep, maskWhatsapp, onlyDigits } from '@/shared/lib/masks'

const STATE_VALUES = BR_STATES.map((s) => s.value) as [string, ...string[]]

// ─── Schema ───────────────────────────────────────────────────────────────────

const addressSchema = z.object({
  id: z.string().optional(),
  isPrimary: z.boolean(),
  zipCode: z.string().refine((v) => onlyDigits(v).length === 8, 'CEP deve ter 8 dígitos'),
  street: z.string().min(2, 'Rua obrigatória').max(200),
  number: z.string().min(1, 'Número obrigatório').max(20),
  complement: z.string().max(200).optional().nullable(),
  neighborhood: z.string().min(1, 'Bairro obrigatório').max(120),
  city: z.string().min(1, 'Cidade obrigatória').max(120),
  state: z.enum(STATE_VALUES, { errorMap: () => ({ message: 'UF obrigatória' }) }),
  reference: z.string().max(200).optional().nullable(),
})

const secondaryPhoneSchema = z.object({
  id: z.string().optional(),
  phone: z.string().refine((v) => onlyDigits(v).length >= 10, 'Telefone inválido'),
  label: z.string().max(40).optional().nullable(),
})

const formSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(120),
  primaryPhone: z.string().refine((v) => onlyDigits(v).length >= 10, 'Telefone inválido'),
  addresses: z.array(addressSchema).min(1, 'Pelo menos 1 endereço'),
  secondaryPhones: z.array(secondaryPhoneSchema),
})

type FormValues = z.infer<typeof formSchema>

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  customer: CustomerDetail
  onClose: () => void
  onSaved?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerEditModal({ customer, onClose, onSaved }: Props) {
  const update = useUpdateCustomer(customer.whatsapp)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: customer.name ?? '',
      primaryPhone: maskWhatsapp(customer.phones.find((p) => p.isPrimary)?.phone ?? customer.whatsapp),
      addresses:
        customer.addresses.length > 0
          ? customer.addresses.map((a) => ({
              id: a.id.startsWith('derived-') ? undefined : a.id,
              isPrimary: a.isPrimary,
              zipCode: maskCep(a.zipCode),
              street: a.street,
              number: a.number,
              complement: a.complement ?? '',
              neighborhood: a.neighborhood,
              city: a.city,
              state: (STATE_VALUES as readonly string[]).includes(a.state) ? a.state : 'SP',
              reference: a.reference ?? '',
            }))
          : [
              {
                isPrimary: true,
                zipCode: '',
                street: '',
                number: '',
                complement: '',
                neighborhood: '',
                city: '',
                state: 'SP',
                reference: '',
              },
            ],
      secondaryPhones: customer.phones
        .filter((p) => !p.isPrimary)
        .map((p) => ({ id: p.id, phone: maskWhatsapp(p.phone), label: p.label ?? '' })),
    },
  })

  const addressesFA = useFieldArray({ control, name: 'addresses' })
  const phonesFA = useFieldArray({ control, name: 'secondaryPhones' })

  const cepLookup = useViaCep()
  // Evita lookup repetido pro mesmo CEP já resolvido.
  const lastLookedUp = useRef<Record<number, string>>({})

  function handleCepLookup(idx: number, digits: string) {
    if (digits.length !== 8) return
    if (lastLookedUp.current[idx] === digits) return
    lastLookedUp.current[idx] = digits
    cepLookup.lookup(digits).then((res) => {
      if (!res) return
      if (res.street) setValue(`addresses.${idx}.street`, res.street, { shouldValidate: true })
      if (res.neighborhood)
        setValue(`addresses.${idx}.neighborhood`, res.neighborhood, { shouldValidate: true })
      if (res.city) setValue(`addresses.${idx}.city`, res.city, { shouldValidate: true })
      if (res.state && (STATE_VALUES as readonly string[]).includes(res.state)) {
        setValue(`addresses.${idx}.state`, res.state as FormValues['addresses'][number]['state'], {
          shouldValidate: true,
        })
      }
    })
  }

  function setPrimaryAddress(index: number) {
    addressesFA.fields.forEach((_, i) => {
      setValue(`addresses.${i}.isPrimary`, i === index)
    })
  }

  async function onSubmit(values: FormValues) {
    setSubmitError(null)
    try {
      await update.mutateAsync({
        name: values.name,
        primaryPhone: onlyDigits(values.primaryPhone),
        addresses: values.addresses.map((a) => ({
          id: a.id,
          isPrimary: a.isPrimary,
          zipCode: onlyDigits(a.zipCode),
          street: a.street,
          number: a.number,
          complement: a.complement || null,
          neighborhood: a.neighborhood,
          city: a.city,
          state: a.state,
          reference: a.reference || null,
        })),
        secondaryPhones: values.secondaryPhones.map((p) => ({
          id: p.id,
          phone: onlyDigits(p.phone),
          label: p.label || null,
        })),
      })
      onSaved?.()
      onClose()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
          ?.error ?? (err as Error)?.message ?? 'Erro ao salvar cliente'
      setSubmitError(msg)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Editar cliente</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Dados básicos */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Dados do cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome *" error={errors.name?.message}>
                <input
                  {...register('name')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nome completo"
                  autoComplete="off"
                />
              </Field>
              <Field label="Telefone principal *" error={errors.primaryPhone?.message}>
                <input
                  {...register('primaryPhone', {
                    onChange: (e) => {
                      e.target.value = maskWhatsapp(e.target.value)
                    },
                  })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(11) 99999-9999"
                  autoComplete="off"
                />
              </Field>
            </div>
          </section>

          {/* Telefones secundários */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Outros telefones</h3>
              <button
                type="button"
                onClick={() => phonesFA.append({ phone: '', label: '' })}
                className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>
            {phonesFA.fields.length === 0 && (
              <p className="text-xs text-gray-400">Nenhum telefone secundário cadastrado.</p>
            )}
            <div className="space-y-2">
              {phonesFA.fields.map((field, idx) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Field label="" error={errors.secondaryPhones?.[idx]?.phone?.message}>
                      <input
                        {...register(`secondaryPhones.${idx}.phone`, {
                          onChange: (e) => {
                            e.target.value = maskWhatsapp(e.target.value)
                          },
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="(11) 99999-9999"
                      />
                    </Field>
                    <Field label="" error={undefined}>
                      <input
                        {...register(`secondaryPhones.${idx}.label`)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: Trabalho, Recado"
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    onClick={() => phonesFA.remove(idx)}
                    className="mt-2 p-2 text-gray-400 hover:text-red-600 transition-colors"
                    aria-label="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Endereços */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Endereços</h3>
              <button
                type="button"
                onClick={() =>
                  addressesFA.append({
                    isPrimary: false,
                    zipCode: '',
                    street: '',
                    number: '',
                    complement: '',
                    neighborhood: '',
                    city: '',
                    state: 'SP',
                    reference: '',
                  })
                }
                className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Adicionar endereço
              </button>
            </div>

            <div className="space-y-4">
              {addressesFA.fields.map((field, idx) => {
                const isPrimary = watch(`addresses.${idx}.isPrimary`)
                return (
                  <div
                    key={field.id}
                    className={`rounded-lg border p-4 ${
                      isPrimary ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <button
                        type="button"
                        onClick={() => setPrimaryAddress(idx)}
                        className={`flex items-center gap-1 text-xs font-semibold ${
                          isPrimary ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'
                        }`}
                      >
                        <Star
                          className={`w-4 h-4 ${isPrimary ? 'fill-blue-600 text-blue-600' : ''}`}
                        />
                        {isPrimary ? 'Endereço principal' : 'Marcar como principal'}
                      </button>
                      {addressesFA.fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            addressesFA.remove(idx)
                            if (isPrimary && addressesFA.fields.length > 1) {
                              setValue(`addresses.0.isPrimary`, true)
                            }
                          }}
                          className="text-gray-400 hover:text-red-600"
                          aria-label="Remover endereço"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Field label="CEP *" error={errors.addresses?.[idx]?.zipCode?.message}>
                        <input
                          {...register(`addresses.${idx}.zipCode`, {
                            onChange: (e) => {
                              const masked = maskCep(e.target.value)
                              e.target.value = masked
                              handleCepLookup(idx, onlyDigits(masked))
                            },
                          })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="01310-100"
                          autoComplete="off"
                        />
                        {cepLookup.isLoading && (
                          <p className="text-xs text-gray-400 mt-1">Buscando CEP...</p>
                        )}
                      </Field>

                      <Field
                        label="Rua *"
                        error={errors.addresses?.[idx]?.street?.message}
                        className="md:col-span-2"
                      >
                        <input
                          {...register(`addresses.${idx}.street`)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Rua / Av."
                        />
                      </Field>

                      <Field label="Número *" error={errors.addresses?.[idx]?.number?.message}>
                        <input
                          {...register(`addresses.${idx}.number`)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="123"
                          inputMode="numeric"
                        />
                      </Field>

                      <Field
                        label="Complemento"
                        error={errors.addresses?.[idx]?.complement?.message}
                        className="md:col-span-2"
                      >
                        <input
                          {...register(`addresses.${idx}.complement`)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Apto, bloco, etc."
                        />
                      </Field>

                      <Field
                        label="Bairro *"
                        error={errors.addresses?.[idx]?.neighborhood?.message}
                      >
                        <input
                          {...register(`addresses.${idx}.neighborhood`)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </Field>

                      <Field label="Cidade *" error={errors.addresses?.[idx]?.city?.message}>
                        <input {...register(`addresses.${idx}.city`)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                      </Field>

                      <Field label="UF *" error={errors.addresses?.[idx]?.state?.message}>
                        <select {...register(`addresses.${idx}.state`)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                          {BR_STATES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.value}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field
                        label="Referência"
                        error={errors.addresses?.[idx]?.reference?.message}
                        className="md:col-span-3"
                      >
                        <input
                          {...register(`addresses.${idx}.reference`)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Ex: Prédio azul, portão preto"
                        />
                      </Field>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}
        </form>

        <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </footer>
      </div>
    </div>
  )
}

// ─── Field helper ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  error?: string
  className?: string
  children: React.ReactNode
}

function Field({ label, error, className, children }: FieldProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      )}
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
