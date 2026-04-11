import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'

import { useCartStore } from '../store/useCartStore'

import { CheckoutDrawer } from './CheckoutDrawer'

export function CartFloat() {
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const items = useCartStore(s => s.items)
  const subtotal = useCartStore(s => s.subtotal)

  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  if (totalQty === 0) return null

  return (
    <>
      <div className="fixed bottom-6 left-4 right-4 z-40 max-w-lg mx-auto">
        <button
          onClick={() => setCheckoutOpen(true)}
          className="w-full bg-green-500 text-white py-3 px-4 rounded-2xl shadow-lg font-bold flex items-center justify-between min-h-[56px]"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart size={20} />
            <span className="bg-white text-green-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">
              {totalQty}
            </span>
          </span>
          <span>Ver carrinho</span>
          <span>{subtotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </button>
      </div>
      <CheckoutDrawer open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </>
  )
}
