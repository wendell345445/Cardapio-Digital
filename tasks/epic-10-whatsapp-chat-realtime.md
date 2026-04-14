# Epic 10 — WhatsApp Chat em Tempo Real + Humano Assume

**Sprint:** 15-16  
**Data:** 2026-04-07  
**Origem:** Spec v2.2 — 6 mudanças solicitadas pelo cliente (Uendell)  
**Referência:** `.specify/changelog/v2.2-migration.md`  
**Referência código:** `/Users/mfabiodias/Sites/Projects/personal-ai` (ConversationView, conversations.service)  
**Total Story Points:** ~41 pts  
**Total Tasks:** 18 tasks

---

## Visão Geral do Epic

Implementar chat WhatsApp em tempo real no painel admin com padrão do projeto personal-ai:
- Baileys salva mensagens recebidas → Socket.io emite → admin vê em tempo real
- Admin pode assumir conversa ("modo humano") e enviar mensagens
- Admin pode devolver para o bot/IA
- WhatsAppPage redesenhada com 3 tabs: Configuração / Mensagens / Chat

| Fase | Foco | Tasks | Pts |
|---|---|---|---|
| 1 | DB + Backend | TASK-101 → TASK-106 | ~15 pts |
| 2 | Socket.io Integration | TASK-107 → TASK-111 | ~8 pts |
| 3 | UI Features | TASK-112 → TASK-118 | ~18 pts |

---

## FASE 1 — DB + Backend

---

## TASK-101: Migration DB — Conversation + ConversationMessage + Novos EventTypes

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 3 story points  
**Dependências:** TASK-095 do Epic 09 concluída (schema base WhatsApp)  
**Tipo:** Feature (DB)

### Descrição
Adicionar modelos `Conversation` e `ConversationMessage` para armazenar o histórico de chat por loja. Adicionar `GREETING` e `ABSENCE` ao enum `WhatsAppEventType`.

### Subtasks
- [x] Abrir `prisma/schema.prisma`
- [x] Adicionar model `Conversation`:
  ```prisma
  model Conversation {
    id            String                @id @default(uuid())
    storeId       String
    customerPhone String
    customerName  String?
    isHumanMode   Boolean               @default(false)
    humanAgentId  String?
    store         Store                 @relation(fields: [storeId], references: [id], onDelete: Cascade)
    messages      ConversationMessage[]
    createdAt     DateTime              @default(now())
    updatedAt     DateTime              @updatedAt
    @@unique([storeId, customerPhone])
    @@index([storeId, updatedAt])
  }
  ```
- [x] Adicionar enum `ConversationMessageRole { CUSTOMER AI AGENT SYSTEM }`
- [x] Adicionar model `ConversationMessage`:
  ```prisma
  model ConversationMessage {
    id             String                  @id @default(uuid())
    conversationId String
    role           ConversationMessageRole
    content        String
    conversation   Conversation            @relation(fields: [conversationId], references: [id], onDelete: Cascade)
    createdAt      DateTime                @default(now())
    @@index([conversationId, createdAt])
  }
  ```
- [x] Adicionar `conversations Conversation[]` no model `Store`
- [x] Adicionar `GREETING` e `ABSENCE` ao enum `WhatsAppEventType`
- [x] Atualizar `TEMPLATE_DEFAULTS` em `messages.service.ts` para incluir os 2 novos
- [x] Rodar: `npx prisma migrate dev --name add-conversation-chat-greeting-absence`
- [x] Verificar: `npx prisma studio`

### Critérios de Aceitação
- [x] Migration roda sem erro
- [x] Prisma Studio exibe `Conversation` e `ConversationMessage`
- [x] `@@unique([storeId, customerPhone])` — não pode haver 2 conversas do mesmo número por loja
- [x] `WhatsAppEventType` tem 11 valores

### Arquivos Modificados
- `prisma/schema.prisma`
- `src/modules/whatsapp/services/messages.service.ts` (adicionar defaults GREETING/ABSENCE)

### Tempo Estimado
1.5h

---

## TASK-102: Conversations Service (adaptar de personal-ai)

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 3 story points  
**Dependências:** TASK-101  
**Tipo:** Feature (Backend)

### Descrição
Criar `conversations.service.ts` no módulo admin, adaptado de `/Users/mfabiodias/Sites/Projects/personal-ai/apps/api/src/modules/conversations/conversations.service.ts`.

**Adaptar para multi-tenant:** todas as queries filtram por `storeId` do token autenticado.

### Subtasks
- [x] Criar `src/modules/admin/services/conversations.service.ts`
- [x] Implementar `getConversations(storeId)`:
  ```typescript
  // Retorna conversas da loja ordenadas por updatedAt desc
  // Include: última mensagem (take: 1, orderBy: createdAt desc)
  ```
- [x] Implementar `getConversationById(storeId, id)`:
  ```typescript
  // Retorna conversa com TODAS as mensagens (orderBy: createdAt asc)
  // Verificar que conversation.storeId === storeId (tenant isolation)
  ```
- [x] Implementar `takeoverConversation(storeId, id, agentId)`:
  ```typescript
  // Verifica storeId, seta isHumanMode=true, humanAgentId
  // Cria mensagem SYSTEM: "Atendente humano assumiu o atendimento."
  // Envia WhatsApp ao cliente: "👨‍💼 Um atendente humano está te atendendo agora!"
  // Emite socket: io.to(`store:${storeId}`).emit('conversation:takeover', {...})
  ```
- [x] Implementar `releaseConversation(storeId, id)`:
  ```typescript
  // Seta isHumanMode=false, humanAgentId=null
  // Cria mensagem SYSTEM: "Atendimento devolvido para o sistema."
  // Envia WhatsApp ao cliente: "🤖 Voltei ao atendimento automático!"
  // Emite socket: io.to(`store:${storeId}`).emit('conversation:released', {...})
  ```
- [x] Implementar `sendAgentMessage(storeId, id, content)`:
  ```typescript
  // Verifica isHumanMode === true (senão 400)
  // Envia via Baileys: sendTextMessage(phone, content)
  // Cria ConversationMessage com role AGENT
  // Emite socket: 'conversation:updated'
  ```

### Critérios de Aceitação
- [x] `getConversations` nunca retorna conversas de outra loja
- [x] `takeoverConversation` silencia o bot (verificação em whatsapp handler)
- [x] `sendAgentMessage` falha com 400 se `isHumanMode = false`
- [x] Socket emitido em cada operação

### Arquivos Criados
- `src/modules/admin/services/conversations.service.ts`

### Tempo Estimado
2h

---

## TASK-103: API — Rotas de Conversação Admin

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 2 story points  
**Dependências:** TASK-102  
**Tipo:** Feature (API)

### Descrição
Criar controller e rotas para os endpoints de conversação.

### Subtasks
- [x] Criar `src/modules/admin/controllers/conversations.controller.ts` com handlers:
  - `GET /admin/whatsapp/conversations`
  - `GET /admin/whatsapp/conversations/:id`
  - `POST /admin/whatsapp/conversations/:id/takeover`
  - `POST /admin/whatsapp/conversations/:id/release`
  - `POST /admin/whatsapp/conversations/:id/message`
- [x] Registrar rotas em `src/modules/admin/routes/whatsapp.routes.ts` (ou criar arquivo)
- [x] Adicionar guard: todas as rotas exigem ADMIN autenticado
- [x] Usar `storeId` do JWT (não do body) para tenant isolation
- [x] Validar body com Zod:
  - `takeover`: `{ agentId?: string }` (default: nome do admin logado)
  - `message`: `{ content: string (min 1) }`

### Critérios de Aceitação
- [x] `GET /admin/whatsapp/conversations` retorna apenas conversas da loja do admin logado
- [x] `POST .../takeover` retorna `{ success: true }` e emite socket
- [x] `POST .../message` sem `isHumanMode` retorna 400

### Arquivos Criados
- `src/modules/admin/controllers/conversations.controller.ts`
- `src/modules/admin/routes/whatsapp.routes.ts` (ou adicionar ao existente)

### Tempo Estimado
1h

---

## TASK-104: Baileys Handler — Salvar Mensagens Recebidas + GREETING + ABSENCE

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 5 story points  
**Dependências:** TASK-101, TASK-102  
**Tipo:** Feature (Backend — crítico)

### Descrição
Modificar o handler de mensagens recebidas do Baileys para:
1. Fazer upsert em `Conversation`
2. Salvar mensagem como `ConversationMessage` com role `CUSTOMER`
3. Verificar `isHumanMode` → se true, não processa AI (apenas salva + emite socket)
4. Disparar `GREETING` na primeira mensagem do dia
5. Disparar `ABSENCE` fora do horário configurado

### Subtasks
- [x] Localizar o handler de `messages.upsert` do Baileys (provavelmente `whatsapp.service.ts`)
- [x] Implementar `upsertConversation(storeId, phone, name?)`:
  ```typescript
  return prisma.conversation.upsert({
    where: { storeId_customerPhone: { storeId, customerPhone: phone } },
    create: { storeId, customerPhone: phone, customerName: name },
    update: { updatedAt: new Date() },
  })
  ```
- [x] Salvar mensagem recebida: `ConversationMessage { role: CUSTOMER, content }`
- [x] Emitir socket `conversation:updated` com payload básico
- [x] Verificar `conversation.isHumanMode`:
  - Se `true` → parar aqui (não responder automaticamente)
  - Se `false` → continuar para AI handler ou messages service
- [x] Verificar se é primeira mensagem do dia (query: msg do customer nas últimas 24h):
  - Se sim → buscar template GREETING e enviar
- [x] Verificar horário de funcionamento da loja:
  - Se fechado → buscar template ABSENCE e enviar; return
- [x] Salvar mensagens enviadas pelo bot também como `ConversationMessage { role: AI }`

### Critérios de Aceitação
- [x] Toda mensagem recebida gera/atualiza `Conversation` e cria `ConversationMessage`
- [x] `isHumanMode = true` → bot silencia, mensagem apenas salva
- [x] Primeira mensagem do cliente → GREETING enviado
- [x] Fora do horário → ABSENCE enviado, sem mais resposta automática
- [x] Socket `conversation:updated` emitido ao receber mensagem

### Arquivos Modificados
- `src/modules/whatsapp/services/whatsapp.service.ts`

### Tempo Estimado
3h

---

## TASK-105: Templates GREETING + ABSENCE nos Defaults + API

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 1 story point  
**Dependências:** TASK-101  
**Tipo:** Feature (Backend)

### Descrição
Adicionar os 2 novos templates ao objeto de defaults no `messages.service.ts` e garantir que os endpoints GET/PUT de templates da TASK-097 incluam os 11 eventos.

### Subtasks
- [x] Em `messages.service.ts`: adicionar `GREETING` e `ABSENCE` ao objeto `TEMPLATE_DEFAULTS`
- [x] Verificar que `GET /admin/settings/whatsapp-messages` retorna todos os 11 eventos (incluindo novos)
- [x] Adicionar labels em PT-BR no frontend: `'GREETING' → 'Saudação'`, `'ABSENCE' → 'Ausência'`
- [x] Verificar que `PUT /admin/settings/whatsapp-messages/GREETING` funciona corretamente

### Tempo Estimado
30min

---

## TASK-106: Testes Integração — Backend Chat

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 3 story points  
**Dependências:** TASK-101 a TASK-105  
**Tipo:** QA

### Subtasks
- [x] Integração: receber mensagem → `Conversation` criada + `ConversationMessage` salva
- [x] Integração: `takeoverConversation` → `isHumanMode = true` + bot silencia
- [x] Integração: `sendAgentMessage` → mensagem enviada + salva como AGENT
- [x] Integração: `releaseConversation` → `isHumanMode = false` + bot volta
- [x] Unitário: GREETING disparado apenas na primeira mensagem do dia
- [x] Unitário: ABSENCE disparado fora do horário
- [x] Integração: tenant isolation — admin loja A não vê conversas loja B

### Tempo Estimado
2h

---

## FASE 2 — Socket.io Integration

---

## TASK-107: Socket.io — Rooms por Loja + Eventos de Conversa

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 3 story points  
**Dependências:** TASK-006 (setup Socket.io Sprint 1), TASK-102  
**Tipo:** Feature (Backend + Frontend)

### Descrição
Configurar Socket.io para emitir eventos de conversa por room de loja. Garantir que admin entra no room correto ao conectar.

### Subtasks

**Backend:**
- [x] Localizar setup Socket.io (`src/lib/socket.ts` ou similar — TASK-006)
- [x] Em `conversations.service.ts`: usar `io.to(`store:${storeId}`)` para emitir eventos
- [x] Em Baileys handler: ao receber mensagem, emitir para room da loja

**Frontend:**
- [x] Localizar hook/setup Socket.io no frontend (criar se não existir)
- [x] Ao logar como admin: `socket.emit('join:store', { storeId })`
- [x] Backend: handler `socket.on('join:store', ({ storeId }) => socket.join(`store:${storeId}`))`
- [x] Garantir que ao deslogar: `socket.leave(`store:${storeId}`)`

### Critérios de Aceitação
- [x] Admin loja A recebe apenas eventos de conversas da loja A
- [x] Dois admins da mesma loja recebem os mesmos eventos
- [x] Admin de loja B não recebe eventos da loja A

### Arquivos Modificados
- `src/lib/socket.ts` (ou equivalente)
- `src/modules/admin/` (handler de join room)
- Frontend: hook de socket ou `src/lib/socket.ts` cliente

### Tempo Estimado
1.5h

---

## TASK-108: Frontend Hook useConversations (React Query + Socket.io)

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 2 story points  
**Dependências:** TASK-107  
**Tipo:** Feature (Frontend)

### Descrição
Criar hook `useConversations` que combina React Query (fetch inicial) com Socket.io (atualizações em tempo real).

### Subtasks
- [x] Criar `src/modules/admin/hooks/useConversations.ts`:
  ```typescript
  export function useConversations() {
    const queryClient = useQueryClient()
    
    const { data } = useQuery({
      queryKey: ['conversations'],
      queryFn: () => api.get('/admin/whatsapp/conversations'),
    })
    
    useSocketEvent('conversation:updated', (event) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversation', event.conversationId] })
    })
    
    useSocketEvent('conversation:takeover', ...)
    useSocketEvent('conversation:released', ...)
    
    return { conversations: data }
  }
  ```
- [x] Criar `useConversation(id)` para conversa individual com mensagens
- [x] Verificar que `useSocketEvent` já existe no projeto (se não, criar baseado em personal-ai)

### Arquivos Criados
- `src/modules/admin/hooks/useConversations.ts`

### Tempo Estimado
1h

---

## TASK-109: TASK-099 Redirect — Mover WhatsAppMessagesTab de SettingsPage

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 1 story point  
**Dependências:** Status de TASK-099 (verificar se foi implementada)  
**Tipo:** Refactor

### Descrição
Garantir que o componente de templates de mensagens WhatsApp está na WhatsApp page (não em SettingsPage).

### Subtasks
- [x] Verificar se `SettingsPage.tsx` já tem tab "Mensagens" (TASK-099 implementada)
- [x] Se SIM: mover `WhatsAppMessagesTab` de SettingsPage para WhatsAppPage; remover de SettingsPage
- [x] Se NÃO: `WhatsAppMessagesTab` já será criada direto na WhatsAppPage (TASK-114)
- [x] Garantir que rota e import estão corretos após a movimentação

### Tempo Estimado
30min

---

## TASK-110: Testes Socket.io

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 2 story points  
**Dependências:** TASK-107, TASK-108  
**Tipo:** QA

### Subtasks
- [x] Integração: admin entra no room → recebe evento de nova mensagem
- [x] E2E: mensagem chega no WhatsApp → aparece na UI sem recarregar
- [x] E2E: dois admins da mesma loja recebem o mesmo evento
- [x] Unitário: isolation de room (loja A não recebe eventos loja B)

### Tempo Estimado
1.5h

---

## FASE 3 — UI Features

---

## TASK-111: Refatorar WhatsAppPage — 3 Tabs

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 3 story points  
**Dependências:** TASK-109  
**Tipo:** Feature (Frontend)

### Descrição
Redesenhar `WhatsAppPage.tsx` com estrutura de 3 tabs usando shadcn/ui `Tabs`.

### Subtasks
- [x] Extrair conteúdo atual (QRCode) para novo componente `WhatsAppConfigTab.tsx`
- [x] Criar estrutura de Tabs em `WhatsAppPage.tsx`:
  ```tsx
  <Tabs defaultValue="config">
    <TabsList>
      <TabsTrigger value="config">Configuração</TabsTrigger>
      <TabsTrigger value="messages">Mensagens</TabsTrigger>
      <TabsTrigger value="chat">
        Chat Online
        {humanModeCount > 0 && <Badge variant="destructive">{humanModeCount}</Badge>}
      </TabsTrigger>
    </TabsList>
    <TabsContent value="config"><WhatsAppConfigTab /></TabsContent>
    <TabsContent value="messages"><WhatsAppMessagesTab /></TabsContent>
    <TabsContent value="chat"><WhatsAppChatTab /></TabsContent>
  </Tabs>
  ```
- [x] `humanModeCount` = número de conversas com `isHumanMode = true` (query ou socket)
- [x] Manter design consistente com outras páginas admin (mesmas cores, padding)

### Arquivos Criados
- `src/modules/admin/components/WhatsAppConfigTab.tsx`

### Arquivos Modificados
- `src/modules/admin/pages/WhatsAppPage.tsx`

### Tempo Estimado
1.5h

---

## TASK-112: UI — WhatsAppChatTab (Lista de Conversas)

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 5 story points  
**Dependências:** TASK-108, TASK-111  
**Tipo:** Feature (Frontend)

### Descrição
Criar componente de lista de conversas com preview da última mensagem, estado de modo (IA/humano) e navegação para o chat.

### Subtasks
- [x] Criar `src/modules/admin/components/WhatsAppChatTab.tsx`
- [x] Usar `useConversations()` hook
- [x] Para cada conversa exibir:
  - Nome/número do cliente
  - Preview da última mensagem (truncado em 60 chars)
  - Timestamp da última mensagem (relativo: "há 2 min")
  - Badge: `🤖 IA` (verde) ou `👨‍💼 Humano` (azul)
  - Se `isHumanMode = true`: destacar visualmente (borda azul ou fundo azul claro)
- [x] Ao clicar: navegar para `ConversationView` (inline ou rota)
- [x] Estado vazio: "Nenhuma conversa ainda. Quando um cliente mandar mensagem, aparece aqui."
- [x] Loading skeleton enquanto carrega
- [x] Ordenar por `updatedAt` desc (mais recente primeiro)

### Arquivos Criados
- `src/modules/admin/components/WhatsAppChatTab.tsx`

### Tempo Estimado
2h

---

## TASK-113: UI — ConversationView (Chat em Tempo Real)

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 5 story points  
**Dependências:** TASK-108, TASK-112  
**Tipo:** Feature (Frontend — adaptar de personal-ai)

### Descrição
Criar componente de visualização da conversa individual, adaptado de:
`/Users/mfabiodias/Sites/Projects/personal-ai/apps/web/src/pages/admin/ConversationView.tsx`

### Subtasks
- [x] Criar `src/modules/admin/components/ConversationView.tsx`
- [x] **Header:** nome/número do cliente + botão toggle "Assumir" / "Devolver para IA"
- [x] **Banner de modo:** azul se `isHumanMode`, verde se IA — texto descritivo
- [x] **Lista de mensagens:**
  - `CUSTOMER`: alinhado à esquerda, fundo cinza, label "Cliente"
  - `AI`: alinhado à direita, fundo âmbar/laranja claro, label "🤖 IA"
  - `AGENT`: alinhado à direita, fundo azul claro, label "👨‍💼 Você"
  - `SYSTEM`: centralizado, texto cinza itálico, sem label
  - Timestamp em cada mensagem
- [x] **Auto-scroll** para última mensagem ao receber nova
- [x] **Input de envio** (visível apenas quando `isHumanMode = true`):
  - Input de texto + botão "Enviar"
  - Enter envia
  - Desabilitado enquanto `sendMutation.isPending`
- [x] Mensagem quando em modo IA: "A IA está respondendo. Assuma para enviar mensagens."
- [x] Socket: `useSocketEvent('conversation:updated', ...)` para atualizar em tempo real

### Arquivos Criados
- `src/modules/admin/components/ConversationView.tsx`

### Tempo Estimado
2.5h

---

## TASK-114: UI — WhatsAppMessagesTab (11 templates, integrar na WhatsApp page)

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 3 story points  
**Dependências:** TASK-101, TASK-111  
**Tipo:** Feature (Frontend)

### Descrição
Criar (ou ajustar se TASK-099 já foi feita) o componente de edição de templates incluindo os 2 novos eventos: GREETING e ABSENCE.

### Subtasks
- [x] Criar ou ajustar `src/modules/admin/components/WhatsAppMessagesTab.tsx`
- [x] Lista de 11 eventos com labels em PT-BR:
  ```
  GREETING         → "Saudação"
  ABSENCE          → "Ausência"
  ORDER_CREATED    → "Pedido Criado"
  WAITING_PAYMENT  → "Aguardando Pagamento"
  CONFIRMED        → "Pedido Confirmado"
  PREPARING        → "Em Preparo"
  DISPATCHED       → "Saiu para Entrega"
  READY_FOR_PICKUP → "Pronto para Retirada"
  DELIVERED        → "Finalizado"
  CANCELLED        → "Cancelado"
  MOTOBOY_ASSIGNED → "Motoboy Designado"
  ```
- [x] Plano 1: textarea readonly com lock icon + tooltip
- [x] Plano 2 / WHATSAPP_AI: textarea editável + botão "Salvar" por evento
- [x] Preview de variáveis: `{{loja}}`, `{{numero}}`, `{{status}}`, `{{itens}}`, `{{total}}`, `{{horario}}` (ABSENCE usa `{{horario}}`)
- [x] Toast de sucesso/erro após salvar

### Arquivos Criados/Modificados
- `src/modules/admin/components/WhatsAppMessagesTab.tsx`

### Tempo Estimado
2h

---

## TASK-115: Testes E2E — Chat em Tempo Real + Humano Assume

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 5 story points  
**Dependências:** Todas as tasks anteriores  
**Tipo:** QA

### Subtasks
- [x] E2E: cliente manda WhatsApp → aparece na tab "Chat" sem recarregar
- [x] E2E: admin clica "Assumir" → banner muda para azul, input aparece
- [x] E2E: admin digita mensagem → cliente recebe no WhatsApp
- [x] E2E: admin clica "Devolver para IA" → banner volta verde, input some
- [x] E2E: WhatsApp page tem 3 tabs; cada tab renderiza conteúdo correto
- [x] E2E: GREETING enviado quando cliente manda primeira mensagem
- [x] E2E: ABSENCE enviado fora do horário
- [x] E2E: admin loja A não vê conversas loja B (tenant isolation)
- [x] Verificar checklist completo de `.specify/changelog/v2.2-migration.md`

### Tempo Estimado
3h

---

## Resumo Sprint 15-16

### Story Points por Fase

| Fase | Tasks | Pts | Tempo Est. |
|---|---|---|---|
| 1 — DB + Backend | TASK-101 a TASK-106 | 17 pts | ~10h |
| 2 — Socket.io | TASK-107 a TASK-110 | 8 pts | ~4.5h |
| 3 — UI | TASK-111 a TASK-115 | 21 pts | ~11h |
| **Total** | **15 tasks** | **46 pts** | **~25.5h** |

### Ordem de Execução

```
TASK-101 (migration DB)
    ↓
TASK-102 (conversations.service)
    ↓
TASK-103 (API routes) ────── TASK-104 (Baileys handler)
    ↓                                  ↓
TASK-105 (templates GREETING/ABSENCE)  ↓
    ↓                                  ↓
TASK-106 (testes backend) ←────────────┘
    ↓
TASK-107 (Socket.io rooms) ──── TASK-109 (TASK-099 redirect)
    ↓
TASK-108 (useConversations hook)
    ↓
TASK-110 (testes socket)
    ↓
TASK-111 (WhatsApp page 3 tabs)
    ↓
TASK-112 (ChatTab lista) ────── TASK-114 (MessagesTab 11 templates)
    ↓
TASK-113 (ConversationView)
    ↓
TASK-115 (Testes E2E)
```

### Dependências Críticas

- **TASK-104** é o coração do epic — Baileys precisa salvar mensagens antes de qualquer UI fazer sentido
- **TASK-107** (Socket.io rooms) é pré-requisito para TASK-108 e toda a UI em tempo real
- **TASK-109** (redirect TASK-099): verificar status antes de implementar TASK-114

### Breaking Changes a Comunicar

| Mudança | Impacto para usuário |
|---|---|
| "Mensagens" não está mais em Configurações | Admin encontra templates em `/admin/whatsapp` tab "Mensagens" |
| GREETING automatico | Clientes recebem saudação automática ao primeiro contato |
| ABSENCE automático | Clientes recebem aviso fora do horário |

---

## TASK-116: FIX — Edição de Templates disponível para todos + Botão "Restaurar padrão"

**Epic:** 10-WhatsApp-Chat  
**Estimativa:** 2 story points  
**Dependências:** TASK-114 (WhatsAppMessagesTab)  
**Tipo:** Bug Fix + Enhancement  
**Prioridade:** Alta

### Contexto do Problema

1. **Bug:** A tab "Mensagens" exibia banner "Edição disponível no Plano Premium" e bloqueava edição para planos não-Premium. Isso está errado: a **edição de templates deve estar disponível para qualquer conta**. A distinção de plano é outra: WhatsApp = apenas disparo de notificações automáticas; WhatsApp AI = respostas automáticas com IA (plano superior).

2. **Feature faltante:** Não havia como um cliente voltar ao texto padrão da plataforma depois de customizar um template. O botão "Restaurar padrão" resolve isso.

### Subtasks

**Backend:**
- [x] `whatsapp-messages.service.ts`: remover parâmetros `storePlan` e `whatsappMode` de `updateWhatsAppMessage`; remover guard `canEdit`
- [x] `whatsapp-messages.service.ts`: adicionar `resetWhatsAppMessage(storeId, eventType)` — deleta o `WhatsAppTemplate` customizado, voltando ao default
- [x] `whatsapp-messages.controller.ts`: simplificar `updateWhatsAppMessageController` (remover fetch de plano)
- [x] `whatsapp-messages.controller.ts`: adicionar `resetWhatsAppMessageController` para `DELETE /:eventType`
- [x] `store.routes.ts`: registrar `DELETE /whatsapp-messages/:eventType`

**Frontend:**
- [x] `WhatsAppMessagesTab.tsx`: remover `canEdit`, remover banner amber "Plano Premium"
- [x] `WhatsAppMessagesTab.tsx`: tornar botão "Editar" sempre visível
- [x] `WhatsAppMessagesTab.tsx`: adicionar mutation `resetMutation` com `DELETE /admin/store/whatsapp-messages/:eventType`
- [x] `WhatsAppMessagesTab.tsx`: exibir botão "Restaurar padrão" quando `item.isCustom === true` (fora do modo edição)

### Critérios de Aceitação
- [x] Qualquer loja (qualquer plano) consegue editar templates sem restrição
- [x] Ao clicar "Restaurar padrão" em um template customizado: template volta ao texto padrão da plataforma, badge "Personalizado" desaparece
- [x] Nenhum banner de plano aparece na tab "Mensagens"
- [x] Backend retorna 403 apenas se `eventType` inválido (não por plano)

### Arquivos Modificados
- `api/src/modules/admin/whatsapp-messages.service.ts`
- `api/src/modules/admin/whatsapp-messages.controller.ts`
- `api/src/modules/admin/store.routes.ts`
- `web/src/modules/admin/components/WhatsAppMessagesTab.tsx`

### Tempo Estimado
1h
