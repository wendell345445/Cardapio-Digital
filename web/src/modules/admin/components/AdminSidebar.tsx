import { useQuery } from '@tanstack/react-query'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageCircle,
  ShoppingBag,
  Package,
  Tag,
  PlusCircle,
  QrCode,
  Clock,
  Settings,
  ExternalLink,
} from 'lucide-react'

import { api } from '@/shared/lib/api'
import { logout as logoutService } from '@/modules/auth/services/auth.service'
import { useAuthStore } from '@/modules/auth/store/useAuthStore'
import { useStore } from '../hooks/useStore'
import { StoreStatusToggle } from './StoreStatusToggle'

const PUBLIC_ROOT_DOMAIN = (import.meta.env.VITE_PUBLIC_ROOT_DOMAIN as string | undefined) || 'supercardapio.com.br'

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Bairros', to: '/admin/bairros', icon: MapPin },
  { label: 'Pedidos', to: '/admin/pedidos', icon: ShoppingBag, badge: true },
  { label: 'Produtos', to: '/admin/produtos', icon: Package },
  { label: 'Categorias', to: '/admin/categorias', icon: Tag },
  { label: 'Adicionais', to: '/admin/adicionais', icon: PlusCircle },
  { label: 'QR Code', to: '/admin/qr-code', icon: QrCode },
  { label: 'WhatsApp', to: '/admin/whatsapp', icon: MessageCircle, statusDot: true },
  { label: 'Horários', to: '/admin/horarios', icon: Clock },
  { label: 'Configurações', to: '/admin/configuracoes', icon: Settings },
]

async function fetchWhatsAppStatus() {
  const { data } = await api.get('/admin/whatsapp/qrcode')
  return data.data as { qrCode: string | null; isConnected: boolean }
}

interface AdminSidebarProps {
  newOrdersCount?: number
}

export function AdminSidebar({ newOrdersCount = 0 }: AdminSidebarProps) {
  const { user, logout } = useAuthStore()
  const { data: store } = useStore()
  const navigate = useNavigate()
  const { data: whatsappStatus } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: fetchWhatsAppStatus,
    refetchInterval: 30_000,
    retry: false,
  })

  async function handleLogout() {
    const refreshToken = sessionStorage.getItem('refresh_token')
    if (refreshToken) {
      await logoutService(refreshToken).catch(() => {})
    }
    logout()
    void navigate('/login')
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'A'

  return (
    <aside className="w-60 h-screen flex flex-col bg-white border-r border-gray-200 fixed left-0 top-0 z-40">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          {store?.logo ? (
            <img
              src={store.logo}
              alt={store.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-500 text-lg">
              🍔
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">
              {store?.name ?? 'Carregando...'}
            </p>
            <p className="text-xs text-gray-500">Painel do restaurante</p>
          </div>
        </div>
        <StoreStatusToggle />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map(({ label, to, icon: Icon, badge, statusDot }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors relative ${
                isActive
                  ? 'bg-red-50 text-red-500 border-l-4 border-red-500'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            {badge && newOrdersCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                {newOrdersCount > 99 ? '99+' : newOrdersCount}
              </span>
            )}
            {statusDot && (
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  whatsappStatus?.isConnected ? 'bg-green-500' : 'bg-red-400'
                }`}
              />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-semibold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name ?? 'Admin'}</p>
          </div>
        </div>
        {store?.slug && (
          <a
            href={`${window.location.protocol}//${store.slug}.${PUBLIC_ROOT_DOMAIN}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors mb-2"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Ver cardápio público
          </a>
        )}
        <button
          onClick={() => void handleLogout()}
          className="flex items-center gap-2 w-full text-sm text-gray-500 hover:text-red-500 py-1.5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
