import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const createStoreSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  slug: z
    .string()
    .min(2, 'Slug obrigatório')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Apenas letras minúsculas, números e hífens'),
  plan: z.enum(['PROFESSIONAL', 'PREMIUM']),
  adminEmail: z.string().email('Email inválido'),
  adminName: z.string().min(2, 'Nome do admin obrigatório'),
  whatsapp: z.string().regex(/^\d{11}$/, 'WhatsApp deve ter 11 dígitos'),
  whatsappMode: z.enum(['WHATSAPP', 'WHATSAPP_AI']).default('WHATSAPP'),
}).refine(
  (data) => !(data.whatsappMode === 'WHATSAPP_AI' && data.plan !== 'PREMIUM'),
  { message: 'WhatsApp com IA requer o plano Premium', path: ['whatsappMode'] }
)

export type CreateStoreFormData = z.infer<typeof createStoreSchema>

interface StoreFormProps {
  onSubmit: (data: CreateStoreFormData) => void
  isLoading?: boolean
}

export function StoreForm({ onSubmit, isLoading }: StoreFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateStoreFormData>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: { plan: 'PROFESSIONAL', whatsappMode: 'WHATSAPP' },
  })

  const selectedPlan = useWatch({ control, name: 'plan' })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome da loja</label>
        <input
          {...register('name')}
          placeholder="Ex: Pizzaria do João"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
        <input
          {...register('slug')}
          placeholder="Ex: pizzaria-do-joao"
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.slug && <p className="mt-1 text-xs text-red-600">{errors.slug.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
        <select
          {...register('plan')}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="PROFESSIONAL">Profissional — R$ 99/mês</option>
          <option value="PREMIUM">Premium — R$ 149/mês</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Admin</label>
        <input
          {...register('adminName')}
          placeholder="Ex: João Silva"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.adminName && (
          <p className="mt-1 text-xs text-red-600">{errors.adminName.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email do Admin</label>
        <input
          {...register('adminEmail')}
          type="email"
          placeholder="admin@loja.com.br"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.adminEmail && (
          <p className="mt-1 text-xs text-red-600">{errors.adminEmail.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          WhatsApp (11 dígitos)
        </label>
        <input
          {...register('whatsapp')}
          placeholder="Ex: 11999998888"
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.whatsapp && (
          <p className="mt-1 text-xs text-red-600">{errors.whatsapp.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Modo WhatsApp</label>
        <div className="space-y-2">
          <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              {...register('whatsappMode')}
              type="radio"
              value="WHATSAPP"
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">WhatsApp</p>
              <p className="text-xs text-gray-500">Notificações automáticas de status dos pedidos</p>
            </div>
          </label>
          <label className={`flex items-start gap-3 p-3 border rounded-lg ${selectedPlan === 'PREMIUM' ? 'cursor-pointer hover:bg-gray-50' : 'opacity-50 cursor-not-allowed bg-gray-50'}`}>
            <input
              {...register('whatsappMode')}
              type="radio"
              value="WHATSAPP_AI"
              disabled={selectedPlan !== 'PREMIUM'}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">
                WhatsApp com IA
                <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Premium</span>
              </p>
              <p className="text-xs text-gray-500">Atendimento inteligente via Ollama IA (requer plano Premium)</p>
            </div>
          </label>
        </div>
        {errors.whatsappMode && (
          <p className="mt-1 text-xs text-red-600">{errors.whatsappMode.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Criando loja...' : 'Criar loja'}
      </button>
    </form>
  )
}
