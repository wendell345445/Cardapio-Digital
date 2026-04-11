import { useState } from 'react'

import { WhatsAppConfigTab } from '../components/WhatsAppConfigTab'
import { WhatsAppMessagesTab } from '../components/WhatsAppMessagesTab'
import { WhatsAppChatTab } from '../components/WhatsAppChatTab'
import { useConversations } from '../hooks/useConversations'

// ─── TASK-111: WhatsApp Page — 3 Tabs (Epic 10) ───────────────────────────────

type Tab = 'config' | 'messages' | 'chat'

const TABS: { id: Tab; label: string }[] = [
  { id: 'config', label: 'Configuração' },
  { id: 'messages', label: 'Mensagens' },
  { id: 'chat', label: 'Chat Online' },
]

export function WhatsAppPage() {
  const [activeTab, setActiveTab] = useState<Tab>('config')
  const { humanModeCount } = useConversations()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.id === 'chat' && humanModeCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {humanModeCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'config' && <WhatsAppConfigTab />}
        {activeTab === 'messages' && <WhatsAppMessagesTab />}
        {activeTab === 'chat' && <WhatsAppChatTab />}
      </div>
    </div>
  )
}
