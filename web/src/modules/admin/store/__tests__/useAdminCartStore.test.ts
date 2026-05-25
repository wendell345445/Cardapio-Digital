import { describe, it, expect, beforeEach } from 'vitest'

import { useAdminCartStore } from '../useAdminCartStore'

const baseItem = {
  productId: '11111111-1111-4111-8111-111111111111',
  productName: 'Pizza Calabresa',
  addons: [],
  quantity: 1,
  unitPrice: 30,
}

describe('useAdminCartStore (PDV)', () => {
  beforeEach(() => {
    useAdminCartStore.setState({ items: [] })
  })

  it('addItem atribui um id e mantém os campos', () => {
    useAdminCartStore.getState().addItem({ ...baseItem })
    const items = useAdminCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBeDefined()
    expect(items[0].productName).toBe('Pizza Calabresa')
  })

  it('updateQty altera a quantidade de um item', () => {
    useAdminCartStore.getState().addItem({ ...baseItem })
    const id = useAdminCartStore.getState().items[0].id
    useAdminCartStore.getState().updateQty(id, 4)
    expect(useAdminCartStore.getState().items[0].quantity).toBe(4)
  })

  it('updateQty para 0 ou menos remove o item', () => {
    useAdminCartStore.getState().addItem({ ...baseItem })
    const id = useAdminCartStore.getState().items[0].id
    useAdminCartStore.getState().updateQty(id, 0)
    expect(useAdminCartStore.getState().items).toHaveLength(0)
  })

  it('subtotal soma unitPrice + adicionais × quantidade', () => {
    useAdminCartStore.getState().addItem({
      ...baseItem,
      unitPrice: 30,
      addons: [{ id: 'a1', name: 'Borda', price: 8 }],
      quantity: 2,
    })
    // (30 + 8) × 2 = 76
    expect(useAdminCartStore.getState().subtotal()).toBe(76)
  })

  it('clear esvazia o carrinho', () => {
    useAdminCartStore.getState().addItem({ ...baseItem })
    useAdminCartStore.getState().clear()
    expect(useAdminCartStore.getState().items).toHaveLength(0)
  })
})
