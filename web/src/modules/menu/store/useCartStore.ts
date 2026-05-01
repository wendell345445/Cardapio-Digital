import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItemAdditional { id: string; name: string; price: number }
export interface CartItem {
  id: string // uuid local
  productId: string; productName: string; imageUrl?: string
  variationId?: string; variationName?: string; variationPrice?: number
  additionals: CartItemAdditional[]
  quantity: number; unitPrice: number; notes?: string
}

interface CartStore {
  storeSlug: string | null
  /** Número da mesa, só populado quando cliente abriu sessão via QR (/mesa/:n) */
  tableNumber: number | null
  /** Token da TableSession (entry-point /mesa/:n cria/entra na sessão) */
  tableSessionToken: string | null
  /** Nome que o cliente informou no scan (null = "Convidado") */
  deviceName: string | null
  items: CartItem[]
  setStore: (slug: string) => void
  setTableSession: (params: {
    tableNumber: number
    token: string
    deviceName: string | null
  }) => void
  clearTableSession: () => void
  addItem: (item: Omit<CartItem, 'id'>) => void
  updateQty: (id: string, quantity: number) => void
  removeItem: (id: string) => void
  clearCart: () => void
  subtotal: () => number
  loadFromHash: (hash: string) => void
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      storeSlug: null,
      tableNumber: null,
      tableSessionToken: null,
      deviceName: null,
      items: [],
      setStore: (slug) => {
        const prev = get().storeSlug
        if (prev && prev !== slug) {
          set({
            storeSlug: slug,
            items: [],
            tableNumber: null,
            tableSessionToken: null,
            deviceName: null,
          })
          return
        }
        set({ storeSlug: slug })
      },
      setTableSession: ({ tableNumber, token, deviceName }) => {
        const prevToken = get().tableSessionToken
        const prevTable = get().tableNumber
        const sameSession = prevToken === token && prevTable === tableNumber
        set({
          tableNumber,
          tableSessionToken: token,
          deviceName,
          items: sameSession ? get().items : [],
        })
      },
      clearTableSession: () =>
        set({ tableNumber: null, tableSessionToken: null, deviceName: null, items: [] }),
      addItem: (item) => set((s) => ({ items: [...s.items, { ...item, id: crypto.randomUUID() }] })),
      updateQty: (id, quantity) => {
        if (quantity <= 0) { get().removeItem(id); return }
        set((s) => ({ items: s.items.map((i) => i.id === id ? { ...i, quantity } : i) }))
      },
      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clearCart: () => set({ items: [] }), // sessão permanece — cliente segue na mesma mesa
      subtotal: () => {
        return get().items.reduce((acc, item) => {
          const base = item.variationPrice ?? item.unitPrice
          const adds = item.additionals.reduce((s, a) => s + a.price, 0)
          return acc + (base + adds) * item.quantity
        }, 0)
      },
      loadFromHash: (hash) => {
        try {
          const decoded = JSON.parse(atob(hash))
          if (Array.isArray(decoded)) {
            set({ items: decoded as CartItem[] })
          }
        } catch { /* ignore invalid hash */ }
      },
    }),
    { name: 'cart-storage' }
  )
)
