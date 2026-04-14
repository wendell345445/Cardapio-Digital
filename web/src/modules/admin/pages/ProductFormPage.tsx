import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { z } from 'zod'


import { ImageUpload } from '../components/ImageUpload'
import { useCategories, useCreateCategory } from '../hooks/useCategories'
import { useCreateProduct, useProduct, useUpdateProduct } from '../hooks/useProducts'

import { ReauthModal } from '@/modules/auth/components/ReauthModal'

// ─── TASK-041: Produtos CRUD Individual ──────────────────────────────────────

const variationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nome obrigatório').max(100),
  price: z.coerce.number().positive('Preço deve ser positivo'),
  isActive: z.boolean().optional().default(true),
})

const additionalSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nome obrigatório').max(100),
  price: z.coerce.number().min(0, 'Preço não pode ser negativo'),
  isActive: z.boolean().optional().default(true),
})

const productFormSchema = z.object({
  categoryId: z.string().uuid('Selecione uma categoria'),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().min(1, 'Imagem obrigatória'),
  basePrice: z.coerce.number().positive().optional().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
  order: z.coerce.number().int().min(0).optional().default(0),
  variations: z.array(variationSchema).optional().default([]),
  additionals: z.array(additionalSchema).optional().default([]),
})

type ProductFormValues = z.infer<typeof productFormSchema>

export function ProductFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = !!id && id !== 'new'
  const initialCategoryId = searchParams.get('categoryId') ?? ''

  const { data: categories } = useCategories()
  const { data: existingProduct, isLoading: isLoadingProduct } = useProduct(isEdit ? id! : '')
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const createCategoryMutation = useCreateCategory()

  const [newCategoryOpen, setNewCategoryOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null)

  const [pendingValues, setPendingValues] = useState<ProductFormValues | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      categoryId: initialCategoryId,
      isActive: true,
      order: 0,
      variations: [],
      additionals: [],
    },
  })

  const {
    fields: variationFields,
    append: appendVariation,
    remove: removeVariation,
  } = useFieldArray({ control, name: 'variations' })

  const {
    fields: additionalFields,
    append: appendAdditional,
    remove: removeAdditional,
  } = useFieldArray({ control, name: 'additionals' })

  const imageUrl = watch('imageUrl')

  // Pré-preenche o form ao editar
  useEffect(() => {
    if (isEdit && existingProduct) {
      reset({
        categoryId: existingProduct.categoryId,
        name: existingProduct.name,
        description: existingProduct.description ?? '',
        imageUrl: existingProduct.imageUrl ?? '',
        basePrice: existingProduct.basePrice ?? ('' as unknown as number),
        isActive: existingProduct.isActive,
        order: existingProduct.order,
        variations: existingProduct.variations.map((v) => ({
          id: v.id,
          name: v.name,
          price: v.price,
          isActive: v.isActive,
        })),
        additionals: existingProduct.additionals.map((a) => ({
          id: a.id,
          name: a.name,
          price: a.price,
          isActive: a.isActive,
        })),
      })
    }
  }, [isEdit, existingProduct, reset])

  function onSubmit(values: ProductFormValues) {
    setPendingValues(values)
  }

  async function persistPendingValues() {
    if (!pendingValues) return
    const payload = {
      ...pendingValues,
      basePrice:
        pendingValues.basePrice === '' ? undefined : (pendingValues.basePrice as number),
    }

    if (isEdit) {
      await updateMutation.mutateAsync({ id: id!, dto: payload })
    } else {
      await createMutation.mutateAsync(payload as Parameters<typeof createMutation.mutateAsync>[0])
    }

    setPendingValues(null)
    navigate('/admin/products')
  }

  async function handleCreateCategory() {
    const name = newCategoryName.trim()
    if (name.length < 2) {
      setNewCategoryError('Nome deve ter pelo menos 2 caracteres')
      return
    }
    try {
      const created = await createCategoryMutation.mutateAsync({ name })
      setValue('categoryId', created.id, { shouldValidate: true })
      setNewCategoryOpen(false)
      setNewCategoryName('')
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
        'Erro ao criar categoria. Tente novamente.'
      setNewCategoryError(msg)
    }
  }

  if (isEdit && isLoadingProduct) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Carregando produto...</p>
      </div>
    )
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const mutationError = createMutation.error || updateMutation.error

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/products')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Voltar
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? 'Editar Produto' : 'Novo Produto'}
        </h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Dados principais */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Dados do produto</h2>

            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                {...register('name')}
                placeholder="Ex: Pizza Margherita"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Categoria */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Categoria <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setNewCategoryName('')
                    setNewCategoryError(null)
                    setNewCategoryOpen(true)
                  }}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  + Nova categoria
                </button>
              </div>
              <select
                {...register('categoryId')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione uma categoria</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="mt-1 text-xs text-red-600">{errors.categoryId.message}</p>
              )}
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Descreva o produto..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              {errors.description && (
                <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
              )}
            </div>

            {/* Preço base e ordem */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço base</label>
                <input
                  {...register('basePrice')}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.basePrice && (
                  <p className="mt-1 text-xs text-red-600">{errors.basePrice.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ordem</label>
                <input
                  {...register('order')}
                  type="number"
                  min="0"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <input
                {...register('isActive')}
                type="checkbox"
                id="isActive"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Produto ativo
              </label>
            </div>

            {/* Imagem */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Imagem <span className="text-red-500">*</span>
              </label>
              <ImageUpload
                value={imageUrl}
                onChange={(url) => setValue('imageUrl', url, { shouldValidate: true })}
              />
              {errors.imageUrl && (
                <p className="mt-1 text-xs text-red-600">{errors.imageUrl.message}</p>
              )}
            </div>
          </div>

          {/* Variações */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">Variações</h2>
              <button
                type="button"
                onClick={() => appendVariation({ name: '', price: 0, isActive: true })}
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                + Adicionar variação
              </button>
            </div>

            {variationFields.length === 0 && (
              <p className="text-sm text-gray-400">Nenhuma variação cadastrada.</p>
            )}

            {variationFields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                  <input
                    {...register(`variations.${index}.name`)}
                    placeholder="Ex: Grande"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.variations?.[index]?.name && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.variations[index]?.name?.message}
                    </p>
                  )}
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Preço</label>
                  <input
                    {...register(`variations.${index}.price`)}
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.variations?.[index]?.price && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.variations[index]?.price?.message}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeVariation(index)}
                  className="mb-0.5 text-red-500 hover:text-red-700 text-sm"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          {/* Adicionais */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">Adicionais</h2>
              <button
                type="button"
                onClick={() => appendAdditional({ name: '', price: 0, isActive: true })}
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                + Adicionar item
              </button>
            </div>

            {additionalFields.length === 0 && (
              <p className="text-sm text-gray-400">Nenhum adicional cadastrado.</p>
            )}

            {additionalFields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                  <input
                    {...register(`additionals.${index}.name`)}
                    placeholder="Ex: Queijo extra"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.additionals?.[index]?.name && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.additionals[index]?.name?.message}
                    </p>
                  )}
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Preço</label>
                  <input
                    {...register(`additionals.${index}.price`)}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.additionals?.[index]?.price && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.additionals[index]?.price?.message}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeAdditional(index)}
                  className="mb-0.5 text-red-500 hover:text-red-700 text-sm"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          {/* Erro geral */}
          {mutationError && (
            <p className="text-sm text-red-600">
              {(mutationError as { response?: { data?: { message?: string } } }).response?.data
                ?.message ?? 'Erro ao salvar produto. Tente novamente.'}
            </p>
          )}

          {/* Ações */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin/products')}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isPending}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar produto'}
            </button>
          </div>
        </form>
      </main>

      <ReauthModal
        open={!!pendingValues}
        title={isEdit ? 'Salvar alterações' : 'Criar produto'}
        description="Por segurança, confirme sua senha para salvar este produto."
        confirmLabel={isEdit ? 'Salvar' : 'Criar'}
        onCancel={() => setPendingValues(null)}
        onConfirm={persistPendingValues}
      />

      {newCategoryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !createCategoryMutation.isPending && setNewCategoryOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900">Nova categoria</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                autoFocus
                value={newCategoryName}
                onChange={(e) => {
                  setNewCategoryName(e.target.value)
                  if (newCategoryError) setNewCategoryError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreateCategory()
                  }
                }}
                placeholder="Ex: Sobremesas"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={createCategoryMutation.isPending}
              />
              {newCategoryError && (
                <p className="mt-1 text-xs text-red-600">{newCategoryError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewCategoryOpen(false)}
                disabled={createCategoryMutation.isPending}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={createCategoryMutation.isPending}
                className="px-3 py-1.5 rounded-md bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
              >
                {createCategoryMutation.isPending ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
