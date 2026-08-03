import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'
import { emit } from '../../shared/socket/socket'
import { withStoreLock } from '../../shared/utils/store-lock'
import { getCatalogCategories, getCatalogs } from '../../shared/ifood/ifood.service'

// ─── Importar catálogo iFood → MenuPanda (só leitura, iFood→nós) ──────────────
// Idempotente (re-import não duplica): Category por nome, Product por (storeId,name),
// Addon/AddonCategory por unique. `order` só na CRIAÇÃO (não sobrescreve ordenação
// manual). Item sem preço → importado INATIVO (o lojista completa antes de publicar).
// Serializado por loja (withStoreLock) — Category não tem @@unique, protege race.

function num(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  return null
}

// Normaliza o preço de um item/opção iFood — pode vir { value } ou number direto.
function priceValue(p: unknown): number | null {
  if (p == null) return null
  if (typeof p === 'number') return num(p)
  return num((p as { value?: unknown }).value)
}

interface NormalizedItem {
  name: string
  description: string | null
  price: number | null
  imageUrl: string | null
  active: boolean
  optionGroups: { name: string; options: { name: string; price: number }[] }[]
}
interface NormalizedCategory {
  name: string
  items: NormalizedItem[]
}

/** Busca o catálogo do iFood e normaliza pro shape que sabemos importar. Defensivo. */
async function fetchNormalizedCatalog(merchantId: string): Promise<NormalizedCategory[]> {
  const catalogs = await getCatalogs(merchantId)
  const out: NormalizedCategory[] = []
  for (const cat of catalogs) {
    const categories = await getCatalogCategories(merchantId, cat.catalogId)
    for (const rawCat of categories) {
      const c = rawCat as Record<string, unknown>
      const items = Array.isArray(c.items) ? (c.items as Record<string, unknown>[]) : []
      out.push({
        name: String(c.name ?? 'Sem categoria').trim(),
        items: items.map((it) => {
          const optionGroups = Array.isArray(it.optionGroups)
            ? (it.optionGroups as Record<string, unknown>[]).map((g) => ({
                name: String(g.name ?? 'Opções').trim(),
                options: (Array.isArray(g.options) ? (g.options as Record<string, unknown>[]) : []).map((o) => ({
                  name: String(o.name ?? 'Opção').trim(),
                  price: priceValue(o.price) ?? 0,
                })),
              }))
            : []
          const price = priceValue(it.price)
          return {
            name: String(it.name ?? 'Item').trim(),
            description: (it.description as string)?.trim() || null,
            price,
            imageUrl: (it.imagePath as string) || (it.logoUrl as string) || null,
            active: String(it.status ?? 'AVAILABLE').toUpperCase() === 'AVAILABLE' && price != null,
            optionGroups,
          }
        }),
      })
    }
  }
  return out
}

export interface ImportPreview {
  categories: number
  products: number
  addonCategories: number
  addons: number
  warnings: string[]
}

async function loadConnected(storeId: string): Promise<string> {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ifoodMerchantId: true } })
  if (!store?.ifoodMerchantId) throw new AppError('Loja não conectada ao iFood', 422)
  return store.ifoodMerchantId
}

/** Preview: mostra o que SERÁ importado (sem persistir). */
export async function previewCatalogImport(storeId: string): Promise<ImportPreview> {
  const merchantId = await loadConnected(storeId)
  const cats = await fetchNormalizedCatalog(merchantId)

  const warnings: string[] = []
  const productNames = new Set<string>()
  let products = 0
  let addons = 0
  const addonCats = new Set<string>()

  for (const c of cats) {
    for (const it of c.items) {
      // Nomes duplicados no catálogo colidiriam no @@unique([storeId,name]) — sinaliza.
      if (productNames.has(it.name.toLowerCase())) {
        warnings.push(`Produto "${it.name}" aparece mais de uma vez — será mesclado (último vence).`)
      }
      productNames.add(it.name.toLowerCase())
      if (it.price == null) warnings.push(`Item "${it.name}" sem preço no iFood — importado como inativo.`)
      products++
      for (const g of it.optionGroups) {
        addonCats.add(g.name.toLowerCase())
        addons += g.options.length
      }
    }
  }

  return { categories: cats.length, products, addonCategories: addonCats.size, addons, warnings }
}

/** Aplica a importação (idempotente, transação, cache invalidado). */
export async function applyCatalogImport(storeId: string, userId?: string): Promise<ImportPreview> {
  const merchantId = await loadConnected(storeId)
  const cats = await fetchNormalizedCatalog(merchantId)

  return withStoreLock(storeId, async () => {
    const preview = await previewCatalogImport(storeId).catch(() => null)

    await prisma.$transaction(async (tx) => {
      // Categorias existentes (lookup por nome; Category não tem @@unique → lock protege).
      const existingCats = await tx.category.findMany({ where: { storeId }, select: { id: true, name: true } })
      const catByName = new Map(existingCats.map((c) => [c.name.toLowerCase(), c.id]))
      let catOrder = existingCats.length

      for (const c of cats) {
        let categoryId = catByName.get(c.name.toLowerCase())
        if (!categoryId) {
          const created = await tx.category.create({
            data: { storeId, name: c.name, order: catOrder++, isActive: true },
          })
          categoryId = created.id
          catByName.set(c.name.toLowerCase(), categoryId)
        }
        // `order` só na criação — não sobrescreve ordenação manual em re-import.

        for (const it of c.items) {
          // Produto por (storeId, name) — upsert.
          const product = await tx.product.upsert({
            where: { storeId_name: { storeId, name: it.name } },
            create: {
              storeId,
              categoryId,
              name: it.name,
              description: it.description,
              basePrice: it.price ?? undefined,
              imageUrl: it.imageUrl ?? undefined,
              isActive: it.active,
              order: 0,
            },
            update: {
              categoryId,
              description: it.description,
              basePrice: it.price ?? undefined,
              imageUrl: it.imageUrl ?? undefined,
              isActive: it.active,
            },
          })

          // Adicionais: optionGroup → AddonCategory; option → Addon; vínculo ProductAddon.
          const addonIds: string[] = []
          for (const g of it.optionGroups) {
            const addonCat = await tx.addonCategory.upsert({
              where: { storeId_name: { storeId, name: g.name } },
              create: { storeId, name: g.name },
              update: {},
            })
            for (const opt of g.options) {
              const addon = await tx.addon.upsert({
                where: { storeId_categoryId_name: { storeId, categoryId: addonCat.id, name: opt.name } },
                create: { storeId, categoryId: addonCat.id, name: opt.name, price: opt.price },
                update: { price: opt.price },
              })
              addonIds.push(addon.id)
            }
          }
          // Dedup por addonId (mesma option em 2 grupos colidiria no @@id([productId,addonId])).
          const uniqueAddonIds = [...new Set(addonIds)]
          await tx.productAddon.deleteMany({ where: { productId: product.id } })
          if (uniqueAddonIds.length > 0) {
            await tx.productAddon.createMany({
              data: uniqueAddonIds.map((addonId, idx) => ({ productId: product.id, addonId, order: idx })),
            })
          }
        }
      }
    })

    // Invalida o cache do menu público + notifica.
    await cache.del(`menu:${storeId}`)
    emit.menuUpdated(storeId)
    await prisma.auditLog.create({
      data: {
        storeId,
        userId: userId ?? null,
        action: 'store.ifood.catalog_imported',
        entity: 'Store',
        entityId: storeId,
        data: (preview ?? {}) as object,
      },
    })

    return preview ?? { categories: cats.length, products: 0, addonCategories: 0, addons: 0, warnings: [] }
  })
}
