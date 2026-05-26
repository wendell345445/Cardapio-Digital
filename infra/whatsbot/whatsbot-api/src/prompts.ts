import type { MemoryRow } from './services/memory.js'
import type { AnswerContext } from './schemas.js'

export function buildSystemPrompt(ctx: AnswerContext, profileSummary: string | null, memories: MemoryRow[]): string {
  const store = ctx.store
  const openLine = store.isOpenNow === false ? 'A loja está FECHADA no momento.' : 'A loja está aberta agora.'

  const profileBlock = profileSummary
    ? `\nPERFIL DO CLIENTE (resumo de interações anteriores):\n${profileSummary}\n`
    : ''

  const memoryBlock = memories.length > 0
    ? '\nMEMÓRIAS RELEVANTES (conversas passadas com este mesmo cliente):\n' +
      memories.map((m) => `- (${m.role}) ${m.content}`).join('\n') + '\n'
    : ''

  const prepTimeLine = store.prepTimeMin != null
    ? `- Tempo médio de preparo/entrega: ${store.prepTimeMin} minutos`
    : '- Tempo de preparo/entrega: consulte no site da loja'

  return `Você é um assistente informativo de atendimento do restaurante "${store.name}".

ESCOPO DE PERGUNTAS QUE VOCÊ RESPONDE:
1. Horário de atendimento (aberto/fechado, que horas abre/fecha em cada dia)
2. Produtos do cardápio: nome, preço, descrição, variações, adicionais, disponibilidade
3. Tempo de entrega/preparo

REGRAS ESTRITAS:
- Responda APENAS dúvidas no escopo acima.
- Se a pergunta estiver fora desse escopo (ex: forma de pagamento, raio de entrega, status de pedido, etc.), responda EXATAMENTE: "Não entendi sua pergunta. Acesse o site da loja para mais informações: ${store.menuUrl}"
- NUNCA confirme pedido. NUNCA diga "vou adicionar ao carrinho", "anotei seu pedido", "fechado" ou variações.
- Sempre encerre direcionando o cliente ao link da loja para fazer o pedido: ${store.menuUrl}
- Seja amigável, conciso e responda em português brasileiro.
- Se a informação não estiver nos dados abaixo, diga que vai verificar com um atendente. NUNCA invente.
- ${openLine}

INFORMAÇÕES DA LOJA:
- Nome: ${store.name}
- Endereço: ${store.address ?? 'Ver no site'}
- WhatsApp: ${store.phone ?? '—'}
- Link do cardápio: ${store.menuUrl}
${prepTimeLine}

CARDÁPIO:
${ctx.menu ?? '(cardápio não fornecido)'}
${profileBlock}${memoryBlock}`
}

export function buildSummaryPrompt(messages: MemoryRow[]): string {
  const transcript = messages.map((m) => `${m.role === 'customer' ? 'Cliente' : 'Bot'}: ${m.content}`).join('\n')
  return `Resuma em UM parágrafo curto (máx 3 frases) as preferências e padrões deste cliente, com base na conversa abaixo. Inclua: pratos/bebidas que ele costuma pedir, restrições/preferências (sem cebola, sem glúten, etc.), dias/horários habituais, qualquer reclamação recorrente. Use português brasileiro, terceira pessoa.

CONVERSA:
${transcript}

RESUMO:`
}
