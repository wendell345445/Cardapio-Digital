import ExcelJS from 'exceljs'

import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'
import { emit } from '../../shared/socket/socket'
import { AppError } from '../../shared/middleware/error.middleware'

export interface ImportRow {
  linha: number
  nome: string
  descricao?: string
  preco?: number
  categoria: string
  variacoes?: string  // ex: "Grande:29.90,Média:24.90"
  adicionais?: string // ex: "Borda Catupiry:5.00,Extra Queijo:3.00"
}

export interface ImportResult {
  success: number
  created: number
  updated: number
  errors: { linha: number; erro: string }[]
  total: number
}

// Gerar template XLSX para download
export async function generateTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Produtos')

  sheet.columns = [
    { header: 'nome', key: 'nome', width: 30 },
    { header: 'descricao', key: 'descricao', width: 40 },
    { header: 'preco', key: 'preco', width: 10 },
    { header: 'categoria', key: 'categoria', width: 20 },
    { header: 'variacoes', key: 'variacoes', width: 40 },
    { header: 'adicionais', key: 'adicionais', width: 40 },
  ]

  // Linha de exemplo
  sheet.addRow({
    nome: 'Pizza Margherita',
    descricao: 'Molho de tomate, mussarela e manjericão',
    preco: 35.90,
    categoria: 'Pizzas',
    variacoes: 'Grande:45.90,Média:35.90,Pequena:25.90',
    adicionais: 'Borda Catupiry:5.00,Extra Queijo:3.00',
  })

  // Estilizar header
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// Parsear e importar planilha
export async function importProducts(
  file: Express.Multer.File,
  storeId: string,
  userId: string,
  ip?: string
): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(file.buffer as any)

  const sheet = workbook.worksheets[0]
  if (!sheet) throw new AppError('Planilha vazia ou inválida', 422)

  // Buscar todas as categorias da loja para lookup
  const categories = await prisma.category.findMany({
    where: { storeId },
    select: { id: true, name: true },
  })
  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))

  const errors: { linha: number; erro: string }[] = []
  let createdCount = 0
  let updatedCount = 0
  const totalRows = sheet.rowCount - 1 // -1 para header

  // Processar cada linha (pular header na linha 1)
  for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum)

    const nome = String(row.getCell(1).value ?? '').trim()
    const descricao = String(row.getCell(2).value ?? '').trim() || undefined
    const precoRaw = row.getCell(3).value
    const categoriaName = String(row.getCell(4).value ?? '').trim()
    const variacoesRaw = String(row.getCell(5).value ?? '').trim()
    const adicionaisRaw = String(row.getCell(6).value ?? '').trim()

    // Validações por linha
    if (!nome) {
      errors.push({ linha: rowNum, erro: 'Nome é obrigatório' })
      continue
    }

    if (!categoriaName) {
      errors.push({ linha: rowNum, erro: 'Categoria é obrigatória' })
      continue
    }

    const categoryId = categoryMap.get(categoriaName.toLowerCase())
    if (!categoryId) {
      errors.push({ linha: rowNum, erro: `Categoria "${categoriaName}" não encontrada` })
      continue
    }

    let basePrice: number | undefined
    if (precoRaw !== null && precoRaw !== '') {
      basePrice = Number(precoRaw)
      if (isNaN(basePrice) || basePrice < 0) {
        errors.push({ linha: rowNum, erro: 'Preço inválido' })
        continue
      }
    }

    // Parsear variações: "Grande:29.90,Média:24.90"
    const variations: { name: string; price: number }[] = []
    if (variacoesRaw) {
      const parts = variacoesRaw.split(',')
      let variacaoError = false
      for (const part of parts) {
        const [varNome, varPreco] = part.split(':')
        if (!varNome || !varPreco) {
          errors.push({ linha: rowNum, erro: `Variação inválida: "${part}". Use formato Nome:Preco` })
          variacaoError = true
          break
        }
        const price = Number(varPreco.trim())
        if (isNaN(price) || price < 0) {
          errors.push({ linha: rowNum, erro: `Preço de variação inválido: "${varPreco}"` })
          variacaoError = true
          break
        }
        variations.push({ name: varNome.trim(), price })
      }
      if (variacaoError) continue
    }

    // Parsear adicionais: "Borda Catupiry:5.00,Extra Queijo:3.00"
    const additionals: { name: string; price: number }[] = []
    if (adicionaisRaw) {
      const parts = adicionaisRaw.split(',')
      let adicionalError = false
      for (const part of parts) {
        const [addNome, addPreco] = part.split(':')
        if (!addNome || !addPreco) {
          errors.push({ linha: rowNum, erro: `Adicional inválido: "${part}". Use formato Nome:Preco` })
          adicionalError = true
          break
        }
        const price = Number(addPreco.trim())
        if (isNaN(price) || price < 0) {
          errors.push({ linha: rowNum, erro: `Preço de adicional inválido: "${addPreco}"` })
          adicionalError = true
          break
        }
        additionals.push({ name: addNome.trim(), price })
      }
      if (adicionalError) continue
    }

    // Upsert produto por nome
    try {
      const wasUpdate = await prisma.$transaction(async (tx) => {
        const existing = await tx.product.findFirst({
          where: { storeId, name: nome },
        })

        let productId: string

        if (existing) {
          await tx.product.update({
            where: { id: existing.id },
            data: { description: descricao, basePrice, categoryId },
          })
          productId = existing.id
          // Recriar variations e additionals
          await tx.productVariation.deleteMany({ where: { productId } })
          await tx.productAdditional.deleteMany({ where: { productId } })
        } else {
          const product = await tx.product.create({
            data: { storeId, categoryId, name: nome, description: descricao, basePrice },
          })
          productId = product.id
        }

        if (variations.length > 0) {
          await tx.productVariation.createMany({
            data: variations.map((v) => ({ productId, ...v })),
          })
        }

        if (additionals.length > 0) {
          await tx.productAdditional.createMany({
            data: additionals.map((a) => ({ productId, ...a })),
          })
        }

        return !!existing
      })
      if (wasUpdate) updatedCount++
      else createdCount++
    } catch {
      errors.push({ linha: rowNum, erro: 'Erro interno ao salvar produto' })
    }
  }

  // Invalidar cache e emitir socket após importação
  const successCount = createdCount + updatedCount
  if (successCount > 0) {
    await cache.del(`menu:${storeId}`)
    emit.menuUpdated(storeId)

    await prisma.auditLog.create({
      data: {
        storeId,
        userId,
        action: 'product.import',
        entity: 'Product',
        data: { createdCount, updatedCount, errorCount: errors.length, total: totalRows },
        ip,
      },
    })
  }

  return { success: successCount, created: createdCount, updated: updatedCount, errors, total: totalRows }
}
