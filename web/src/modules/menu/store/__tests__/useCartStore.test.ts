import { describe, it, expect, beforeEach } from 'vitest'

import { useCartStore } from '../useCartStore'

const baseItem = {
  productId: '11111111-1111-4111-8111-111111111111',
  productName: 'Pizza Calabresa',
  additionals: [],
  quantity: 1,
  unitPrice: 30,
}

describe('useCartStore', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], storeSlug: null, tableNumber: null })
  })

  it('addItem atribui um id uuid e mantém demais campos', () => {
    useCartStore.getState().addItem({ ...baseItem })
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBeDefined()
    expect(items[0].productName).toBe('Pizza Calabresa')
    expect(items[0].quantity).toBe(1)
  })

  it('updateQty altera quantidade de um item específico', () => {
    useCartStore.getState().addItem({ ...baseItem })
    const id = useCartStore.getState().items[0].id
    useCartStore.getState().updateQty(id, 3)
    expect(useCartStore.getState().items[0].quantity).toBe(3)
  })

  it('updateQty com 0 remove o item do carrinho', () => {
    useCartStore.getState().addItem({ ...baseItem })
    const id = useCartStore.getState().items[0].id
    useCartStore.getState().updateQty(id, 0)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('updateQty com valor negativo remove o item', () => {
    useCartStore.getState().addItem({ ...baseItem })
    const id = useCartStore.getState().items[0].id
    useCartStore.getState().updateQty(id, -1)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('removeItem exclui apenas o item indicado', () => {
    useCartStore.getState().addItem({ ...baseItem })
    useCartStore.getState().addItem({
      ...baseItem,
      productId: '22222222-2222-4222-8222-222222222222',
      productName: 'Pizza Marguerita',
    })
    const firstId = useCartStore.getState().items[0].id
    useCartStore.getState().removeItem(firstId)
    const remaining = useCartStore.getState().items
    expect(remaining).toHaveLength(1)
    expect(remaining[0].productName).toBe('Pizza Marguerita')
  })

  it('subtotal considera preço base + adicionais × quantidade', () => {
    useCartStore.getState().addItem({
      ...baseItem,
      unitPrice: 30,
      additionals: [{ id: 'a1', name: 'Borda', price: 5 }],
      quantity: 2,
    })
    expect(useCartStore.getState().subtotal()).toBe(70) // (30 + 5) * 2
  })

  it('subtotal usa variationPrice quando presente, ignorando unitPrice', () => {
    useCartStore.getState().addItem({
      ...baseItem,
      unitPrice: 30,
      variationId: '33333333-3333-4333-8333-333333333333',
      variationName: 'Grande',
      variationPrice: 50,
      quantity: 1,
    })
    expect(useCartStore.getState().subtotal()).toBe(50)
  })
})
