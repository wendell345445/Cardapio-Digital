import { buildSummaryPrompt } from '../prompts.js'

import { getRecentMessages, setProfileSummary } from './memory.js'
import { chat } from './ollama.js'

const RECENT_FOR_SUMMARY = 40

export function scheduleProfileRefresh(storeId: string, customerPhone: string): void {
  setImmediate(() => {
    void refreshProfile(storeId, customerPhone).catch((err) => {
      console.error('[profile-updater] falhou', { storeId, customerPhone, err: String(err) })
    })
  })
}

async function refreshProfile(storeId: string, customerPhone: string): Promise<void> {
  const messages = await getRecentMessages(storeId, customerPhone, RECENT_FOR_SUMMARY)
  if (messages.length < 4) return
  const prompt = buildSummaryPrompt(messages)
  const summary = await chat([
    { role: 'system', content: 'Você gera resumos curtos e objetivos de perfis de clientes.' },
    { role: 'user', content: prompt },
  ])
  await setProfileSummary(storeId, customerPhone, summary)
}
