import { useNewOrdersCount } from '../hooks/useNewOrdersCount'
import { useStore } from '../hooks/useStore'

import { AdminSidebar } from './AdminSidebar'
import { AdminGuard } from './AdminGuard'
import { SuspendedScreen } from './SuspendedScreen'

interface AdminLayoutProps {
  children: React.ReactNode
}

function AdminLayoutInner({ children }: AdminLayoutProps) {
  const { count } = useNewOrdersCount()

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar newOrdersCount={count} />
      <main className="flex-1 overflow-y-auto bg-gray-50 ml-60">
        {children}
      </main>
    </div>
  )
}

// Roda DENTRO do AdminGuard (já garantiu auth + role=ADMIN). Bloqueia toda a UI
// quando store.status === 'SUSPENDED' renderizando a SuspendedScreen — não monta
// o AdminLayoutInner, então as queries de orders/etc nem disparam (evita 403s
// em background pelo `requireActiveStore` do backend).
function AdminLayoutWithSuspensionGuard({ children }: AdminLayoutProps) {
  const { data: store, isLoading } = useStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Carregando…
      </div>
    )
  }

  if (store?.status === 'SUSPENDED') {
    return <SuspendedScreen />
  }

  return <AdminLayoutInner>{children}</AdminLayoutInner>
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AdminGuard>
      <AdminLayoutWithSuspensionGuard>{children}</AdminLayoutWithSuspensionGuard>
    </AdminGuard>
  )
}
