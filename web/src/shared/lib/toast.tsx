import { useEffect } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { create } from 'zustand'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastEntry {
  id: number
  variant: ToastVariant
  title: string
  description?: string
}

interface ToastStore {
  toasts: ToastEntry[]
  push: (variant: ToastVariant, title: string, description?: string) => void
  dismiss: (id: number) => void
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (variant, title, description) =>
    set((s) => ({
      toasts: [...s.toasts, { id: Date.now() + Math.random(), variant, title, description }],
    })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push('success', title, description),
  error: (title: string, description?: string) =>
    useToastStore.getState().push('error', title, description),
  info: (title: string, description?: string) =>
    useToastStore.getState().push('info', title, description),
}

const VARIANT_STYLES: Record<ToastVariant, { icon: React.ElementType; bg: string; iconColor: string }> = {
  success: { icon: CheckCircle2, bg: 'bg-white border-green-200', iconColor: 'text-green-600' },
  error: { icon: XCircle, bg: 'bg-white border-red-200', iconColor: 'text-red-600' },
  info: { icon: Info, bg: 'bg-white border-blue-200', iconColor: 'text-blue-600' },
}

function ToastItem({ entry }: { entry: ToastEntry }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const cfg = VARIANT_STYLES[entry.variant]
  const Icon = cfg.icon

  // Auto-dismiss em 4s — Radix tem duration mas eu controlo o store também,
  // senão a entrada "morta" continua na lista pra sempre.
  useEffect(() => {
    const timer = setTimeout(() => dismiss(entry.id), 4000)
    return () => clearTimeout(timer)
  }, [entry.id, dismiss])

  return (
    <ToastPrimitive.Root
      duration={4000}
      onOpenChange={(open) => {
        if (!open) dismiss(entry.id)
      }}
      className={`${cfg.bg} border rounded-xl shadow-lg p-4 flex items-start gap-3 min-w-[320px] data-[state=open]:animate-in data-[state=open]:slide-in-from-right-5 data-[state=closed]:animate-out data-[state=closed]:fade-out`}
    >
      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cfg.iconColor}`} />
      <div className="flex-1 min-w-0">
        <ToastPrimitive.Title className="font-semibold text-sm text-gray-900">
          {entry.title}
        </ToastPrimitive.Title>
        {entry.description && (
          <ToastPrimitive.Description className="text-xs text-gray-600 mt-0.5">
            {entry.description}
          </ToastPrimitive.Description>
        )}
      </div>
      <ToastPrimitive.Close
        className="flex-shrink-0 text-gray-400 hover:text-gray-600"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {children}
      {toasts.map((t) => (
        <ToastItem key={t.id} entry={t} />
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 z-[9999] outline-none" />
    </ToastPrimitive.Provider>
  )
}
