import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'

import { api } from '@/shared/lib/api'

// ─── TASK-099 + TASK-114 + TASK-116: WhatsApp Messages Tab (11 templates) ────

interface WhatsAppMessageItem {
  eventType: string
  label: string
  template: string
  isCustom: boolean
}

async function fetchWhatsAppMessages(): Promise<WhatsAppMessageItem[]> {
  const { data } = await api.get('/admin/store/whatsapp-messages')
  return data.data
}

async function updateTemplate(eventType: string, template: string): Promise<void> {
  await api.put(`/admin/store/whatsapp-messages/${eventType}`, { template })
}

async function resetTemplate(eventType: string): Promise<void> {
  await api.delete(`/admin/store/whatsapp-messages/${eventType}`)
}

const VARS_BY_EVENT: Record<string, string[]> = {
  GREETING:         ['{{loja}}'],
  ABSENCE:          ['{{loja}}', '{{horario}}'],
  ORDER_CREATED:    ['{{numero}}', '{{loja}}', '{{itens}}', '{{total}}'],
  WAITING_PAYMENT:  ['{{numero}}', '{{loja}}', '{{total}}'],
  CONFIRMED:        ['{{numero}}', '{{loja}}', '{{status}}', '{{itens}}', '{{total}}'],
  PREPARING:        ['{{numero}}', '{{loja}}', '{{status}}', '{{itens}}', '{{total}}'],
  DISPATCHED:       ['{{numero}}', '{{loja}}', '{{status}}', '{{itens}}', '{{total}}'],
  DELIVERED:        ['{{numero}}', '{{loja}}', '{{status}}', '{{itens}}', '{{total}}'],
  CANCELLED:        ['{{numero}}', '{{loja}}', '{{status}}', '{{itens}}', '{{total}}'],
  READY_FOR_PICKUP: ['{{numero}}', '{{loja}}', '{{status}}', '{{itens}}', '{{total}}'],
  MOTOBOY_ASSIGNED: ['{{numero}}', '{{loja}}', '{{total}}'],
}

export function WhatsAppMessagesTab() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Record<string, string>>({})

  const { data: messages, isLoading } = useQuery({
    queryKey: ['whatsapp-messages'],
    queryFn: fetchWhatsAppMessages,
  })

  const saveMutation = useMutation({
    mutationFn: ({ eventType, template }: { eventType: string; template: string }) =>
      updateTemplate(eventType, template),
    onSuccess: (_, { eventType }) => {
      void qc.invalidateQueries({ queryKey: ['whatsapp-messages'] })
      setEditing((prev) => {
        const next = { ...prev }
        delete next[eventType]
        return next
      })
    },
    onError: () => alert('Erro ao salvar template.'),
  })

  const resetMutation = useMutation({
    mutationFn: (eventType: string) => resetTemplate(eventType),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['whatsapp-messages'] })
    },
    onError: () => alert('Erro ao restaurar template.'),
  })

  if (isLoading) {
    return <p className="text-sm text-gray-500 py-8 text-center">Carregando mensagens...</p>
  }

  return (
    <div className="space-y-4">
      {(messages ?? []).map((item) => {
          const isEditing = item.eventType in editing
          const currentText = editing[item.eventType] ?? item.template
          const availableVars = VARS_BY_EVENT[item.eventType] ?? []

          return (
            <div key={item.eventType} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-800">{item.label}</p>
                  {item.isCustom && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                      Personalizado
                    </span>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-3">
                    {item.isCustom && (
                      <button
                        onClick={() => resetMutation.mutate(item.eventType)}
                        disabled={resetMutation.isPending}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        title="Restaurar texto padrão da plataforma"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restaurar padrão
                      </button>
                    )}
                    <button
                      onClick={() => setEditing((prev) => ({ ...prev, [item.eventType]: item.template }))}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>

              {availableVars.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mb-3">
                  <span className="text-xs font-medium text-gray-500 mr-1">Variáveis:</span>
                  {availableVars.map((v) => (
                    <code key={v} className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 font-mono">
                      {v}
                    </code>
                  ))}
                </div>
              )}

              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={currentText}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [item.eventType]: e.target.value }))
                    }
                    rows={4}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        saveMutation.mutate({ eventType: item.eventType, template: currentText })
                      }
                      disabled={saveMutation.isPending}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      onClick={() =>
                        setEditing((prev) => {
                          const next = { ...prev }
                          delete next[item.eventType]
                          return next
                        })
                      }
                      className="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <pre className="text-xs text-gray-600 bg-gray-50 rounded p-3 whitespace-pre-wrap font-sans">
                  {item.template}
                </pre>
              )}
            </div>
          )
        })}
    </div>
  )
}
