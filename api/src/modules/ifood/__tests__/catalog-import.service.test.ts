// ─── Import de catálogo iFood → MenuPanda (preview) ───────────────────────────
// Cobre: contagem de categorias/produtos/adicionais, warnings (nome duplicado,
// item sem preço) e a exigência de loja conectada.

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: { store: { findUnique: jest.fn() } },
}))

jest.mock('../../../shared/redis/redis', () => ({
  cache: { del: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: { menuUpdated: jest.fn() },
}))

jest.mock('../../../shared/utils/store-lock', () => ({
  withStoreLock: (_storeId: string, fn: () => Promise<unknown>) => fn(),
}))

jest.mock('../../../shared/ifood/ifood.service', () => ({
  getCatalogs: jest.fn(),
  getCatalogCategories: jest.fn(),
}))

import { prisma } from '../../../shared/prisma/prisma'
import { getCatalogCategories, getCatalogs } from '../../../shared/ifood/ifood.service'
import { previewCatalogImport } from '../catalog-import.service'

describe('previewCatalogImport', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(prisma.store.findUnique as jest.Mock).mockResolvedValue({ ifoodMerchantId: 'merchant-1' })
    ;(getCatalogs as jest.Mock).mockResolvedValue([{ catalogId: 'cat-1' }])
  })

  it('lança 422 se a loja não está conectada', async () => {
    ;(prisma.store.findUnique as jest.Mock).mockResolvedValue({ ifoodMerchantId: null })

    await expect(previewCatalogImport('store-1')).rejects.toMatchObject({ status: 422 })
  })

  it('conta categorias, produtos e adicionais', async () => {
    ;(getCatalogCategories as jest.Mock).mockResolvedValue([
      {
        name: 'Lanches',
        items: [
          {
            name: 'X-Burger',
            price: { value: 20 },
            status: 'AVAILABLE',
            optionGroups: [{ name: 'Extras', options: [{ name: 'Bacon', price: { value: 5 } }] }],
          },
          { name: 'X-Salada', price: { value: 22 }, status: 'AVAILABLE', optionGroups: [] },
        ],
      },
      { name: 'Bebidas', items: [{ name: 'Coca', price: { value: 8 }, status: 'AVAILABLE' }] },
    ])

    const p = await previewCatalogImport('store-1')
    expect(p.categories).toBe(2)
    expect(p.products).toBe(3)
    expect(p.addonCategories).toBe(1)
    expect(p.addons).toBe(1)
    expect(p.warnings).toHaveLength(0)
  })

  it('avisa sobre item sem preço e nome duplicado', async () => {
    ;(getCatalogCategories as jest.Mock).mockResolvedValue([
      {
        name: 'Lanches',
        items: [
          { name: 'X-Burger', price: { value: 20 }, status: 'AVAILABLE' },
          { name: 'X-Burger', price: { value: 25 }, status: 'AVAILABLE' }, // duplicado
          { name: 'Sem Preço', status: 'AVAILABLE' }, // sem price
        ],
      },
    ])

    const p = await previewCatalogImport('store-1')
    expect(p.warnings.some((w) => w.includes('mais de uma vez'))).toBe(true)
    expect(p.warnings.some((w) => w.includes('sem preço'))).toBe(true)
  })

  it('aceita price como number direto (não só { value })', async () => {
    ;(getCatalogCategories as jest.Mock).mockResolvedValue([
      { name: 'X', items: [{ name: 'Item', price: 15, status: 'AVAILABLE' }] },
    ])

    const p = await previewCatalogImport('store-1')
    expect(p.products).toBe(1)
    expect(p.warnings).toHaveLength(0)
  })
})
