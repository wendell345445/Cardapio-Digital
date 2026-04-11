import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { OAuthCallbackPage } from '@/modules/auth/pages/OAuthCallbackPage'
import { RegisterStorePage } from '@/modules/auth/pages/RegisterStorePage'
import { AdminLayout } from '@/modules/admin/components/AdminLayout'
import { AdminDashboardPage } from '@/modules/admin/pages/AdminDashboardPage'
import { CategoriesPage } from '@/modules/admin/pages/CategoriesPage'
import { ImportProductsPage } from '@/modules/admin/pages/ImportProductsPage'
import { ProductFormPage } from '@/modules/admin/pages/ProductFormPage'
import { ProductsPage } from '@/modules/admin/pages/ProductsPage'
import { SettingsPage } from '@/modules/admin/pages/SettingsPage'
import { WhatsAppPage } from '@/modules/admin/pages/WhatsAppPage'
import { TablesPage } from '@/modules/admin/pages/TablesPage'
import { QRCodePage } from '@/modules/admin/pages/QRCodePage'
import { OrdersPage } from '@/modules/admin/pages/OrdersPage'
import { OrderHistoryPage } from '@/modules/admin/pages/OrderHistoryPage'
import { CouponsPage } from '@/modules/admin/pages/CouponsPage'
import { DeliveryPage } from '@/modules/admin/pages/DeliveryPage'
import { AnalyticsPage } from '@/modules/admin/pages/AnalyticsPage'
import { ClientsPage } from '@/modules/admin/pages/ClientsPage'
import { CashFlowPage } from '@/modules/admin/pages/CashFlowPage'
import { AdicionaisPage } from '@/modules/admin/pages/AdicionaisPage'
import { BairrosPage } from '@/modules/admin/pages/BairrosPage'
import { HorariosPage } from '@/modules/admin/pages/HorariosPage'
import { CheckoutPage } from '@/modules/menu/pages/CheckoutPage'
import { ItemPage } from '@/modules/menu/pages/ItemPage'
import { MenuPage } from '@/modules/menu/pages/MenuPage'
import { OrderTrackingPage } from '@/modules/menu/pages/OrderTrackingPage'
import { MotoboyPage } from '@/modules/motoboy/pages/MotoboyPage'
import { OwnerGuard } from '@/modules/owner/components/OwnerGuard'
import { DashboardPage } from '@/modules/owner/pages/DashboardPage'
import { NewStorePage } from '@/modules/owner/pages/NewStorePage'
import { StoreDetailPage } from '@/modules/owner/pages/StoreDetailPage'
import { useAuthStore } from '@/modules/auth/store/useAuthStore'
import { useStoreSlug } from '@/hooks/useStoreSlug'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
})

function RootRoute() {
  const slug = useStoreSlug()
  if (!slug) return <Navigate to="/login" replace />
  return <MenuPage />
}

function DashboardRedirect() {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === 'OWNER') {
    return <Navigate to="/owner/dashboard" replace />
  }

  if (user.role === 'ADMIN') {
    return <Navigate to="/admin/dashboard" replace />
  }

  return <Navigate to="/login" replace />
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/dashboard" element={<DashboardRedirect />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterStorePage />} />
          <Route path="/auth/callback" element={<OAuthCallbackPage />} />

          {/* Owner */}
          <Route
            path="/owner/dashboard"
            element={
              <OwnerGuard>
                <DashboardPage />
              </OwnerGuard>
            }
          />
          <Route
            path="/owner/stores/new"
            element={
              <OwnerGuard>
                <NewStorePage />
              </OwnerGuard>
            }
          />
          <Route
            path="/owner/stores/:id"
            element={
              <OwnerGuard>
                <StoreDetailPage />
              </OwnerGuard>
            }
          />
          <Route path="/owner" element={<Navigate to="/owner/dashboard" replace />} />

          {/* Cardápio público — slug vem do hostname (subdomain routing) */}
          <Route path="/" element={<RootRoute />} />
          <Route path="/produto/:productId" element={<ItemPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/pedido/:token" element={<OrderTrackingPage />} />

          {/* Admin — login e redirect base */}
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

          {/* Admin — rotas PT com AdminLayout */}
          <Route
            path="/admin/dashboard"
            element={
              <AdminLayout>
                <AdminDashboardPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/pedidos"
            element={
              <AdminLayout>
                <OrdersPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/pedidos/historico"
            element={
              <AdminLayout>
                <OrderHistoryPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/produtos"
            element={
              <AdminLayout>
                <ProductsPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/produtos/new"
            element={
              <AdminLayout>
                <ProductFormPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/produtos/:id/edit"
            element={
              <AdminLayout>
                <ProductFormPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/produtos/importar"
            element={
              <AdminLayout>
                <ImportProductsPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/categorias"
            element={
              <AdminLayout>
                <CategoriesPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/adicionais"
            element={
              <AdminLayout>
                <AdicionaisPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/bairros"
            element={
              <AdminLayout>
                <BairrosPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/horarios"
            element={
              <AdminLayout>
                <HorariosPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/qr-code"
            element={
              <AdminLayout>
                <QRCodePage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/configuracoes"
            element={
              <AdminLayout>
                <SettingsPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/whatsapp"
            element={
              <AdminLayout>
                <WhatsAppPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/cupons"
            element={
              <AdminLayout>
                <CouponsPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/entrega"
            element={
              <AdminLayout>
                <DeliveryPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <AdminLayout>
                <AnalyticsPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/clientes"
            element={
              <AdminLayout>
                <ClientsPage />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/caixa"
            element={
              <AdminLayout>
                <CashFlowPage />
              </AdminLayout>
            }
          />

          {/* Owner — admins adicionais (rota preventiva, feature em TASK-0910) */}
          <Route
            path="/owner/stores/:id/admins"
            element={
              <OwnerGuard>
                <StoreDetailPage />
              </OwnerGuard>
            }
          />

          {/* Redirects de compatibilidade — rotas antigas → novas */}
          <Route path="/admin/orders" element={<Navigate to="/admin/pedidos" replace />} />
          <Route path="/admin/orders/history" element={<Navigate to="/admin/pedidos/historico" replace />} />
          <Route path="/admin/products" element={<Navigate to="/admin/produtos" replace />} />
          <Route path="/admin/products/new" element={<Navigate to="/admin/produtos/new" replace />} />
          <Route path="/admin/products/import" element={<Navigate to="/admin/produtos/importar" replace />} />
          <Route path="/admin/products/:id/edit" element={<Navigate to="/admin/produtos/:id/edit" replace />} />
          <Route path="/admin/categories" element={<Navigate to="/admin/categorias" replace />} />
          <Route path="/admin/settings" element={<Navigate to="/admin/configuracoes" replace />} />
          <Route path="/admin/tables" element={<Navigate to="/admin/qr-code" replace />} />
          <Route path="/admin/delivery" element={<Navigate to="/admin/entrega" replace />} />
          <Route path="/admin/coupons" element={<Navigate to="/admin/cupons" replace />} />
          <Route path="/admin/clients" element={<Navigate to="/admin/clientes" replace />} />
          <Route path="/admin/cashflow" element={<Navigate to="/admin/caixa" replace />} />

          {/* Admin legacy — sem AdminLayout (mantidos por compatibilidade) */}
          <Route
            path="/admin/tables-legacy"
            element={
              <AdminLayout>
                <TablesPage />
              </AdminLayout>
            }
          />

          {/* Motoboy */}
          <Route path="/motoboy" element={<MotoboyPage />} />

          <Route
            path="*"
            element={
              <div className="p-8 text-center">
                <h1 className="text-2xl font-bold">Menu Panda</h1>
                <p className="text-gray-500 mt-2">Página não encontrada.</p>
                <a href="/login" className="text-blue-600 hover:underline text-sm mt-4 inline-block">
                  Ir para login
                </a>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
