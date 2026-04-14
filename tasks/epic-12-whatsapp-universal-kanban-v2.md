# Epic 12 — WhatsApp Universal Messages + Orders Kanban v2

> US-007 (modificado), US-009 (modificado)  
> Ref: `.specify/changelog/v2.4-migration.md`

**Sprint:** 18  
**Total estimado:** ~13 story points  
**Total tasks:** 7  
**Status:** ✅ CONCLUÍDO — 2026-04-07  
**Contexto:** Cliente (Uendell) identificou que mensagens WhatsApp não disparavam em modo WHATSAPP básico, e que colunas "Confirmado" e "Cancelados" estavam ausentes no Kanban. Esta epic corrige os problemas e adiciona o botão manual "Aguardando Pix".

---

## Fase 1 — Fix Backend: Mensagens Universais

### TASK-121: Fix — messages.service.ts: Fallback obrigatório para template padrão ✅

**Epic:** 12  
**Story:** US-007 (v2.4)  
**Estimativa:** 2 pts  
**Dependências:** TASK-097 (Epic 09 — já implementado)

### Subtasks
- [x] Verificar `getTemplate(storeId, eventType)` — retorna `DEFAULT_TEMPLATES[eventType]` quando não há template customizado (nunca retorna `null` ou `undefined`) — já estava correto
- [x] Verificar guard de `whatsappMode` no pipeline de envio — não bloqueia envio para modo WHATSAPP básico — confirmado (sem guard de modo no orders.service.ts)
- [x] Garantir que TODOS os 11 eventos têm default em `DEFAULT_TEMPLATES` — confirmado e coberto por teste
- [x] Adicionar test: loja sem template → mensagem padrão enviada — **`whatsapp-messages-fallback.test.ts`**
- [x] Corrigir `READY → READY_FOR_PICKUP` para pedidos PICKUP em `sendStatusUpdateMessage` (bug identificado)
- [x] Adicionar `PENDING → CONFIRMED` em `STATUS_TRANSITIONS` (frontend usava transição não permitida)
- [x] Passar `order.type` para `sendStatusUpdateMessage` em `orders.service.ts`

### Critérios de Done
- [x] `getTemplate()` nunca retorna null — sempre um string
- [x] Modo WHATSAPP básico envia todos os status automáticos
- [x] Testes passando para todos os 11 eventos
- [x] Sem regressão em lojas com template customizado

---

### TASK-122: Fix — orders.service.ts: Garantir disparo de CANCELLED ✅

**Epic:** 12  
**Story:** US-007 (v2.4), US-009 (v2.4)  
**Estimativa:** 1 pt  
**Dependências:** TASK-121

### Subtasks
- [x] Verificar fluxo de cancelamento em `orders.service.ts` — confirmado que `sendStatusUpdateMessage` é chamado para todo status change incluindo CANCELLED
- [x] `CANCELLED` está no `eventMap` de `sendStatusUpdateMessage` — sem alteração necessária
- [x] AuditLog: cancelamento já registrado em `updateOrderStatus` com `cancelledAt` timestamp
- [x] Adicionar test: cancelar pedido → `sendStatusUpdateMessage` chamado com `CANCELLED` — **`orders.service.test.ts`**

### Critérios de Done
- [x] Cancelar pedido dispara mensagem "Pedido cancelado" via WhatsApp
- [x] Test cobrindo o fluxo

---

## Fase 2 — Feature: Botão "Aguardando Pix"

### TASK-123: API — PATCH /admin/orders/:id/send-waiting-payment ✅

**Epic:** 12  
**Story:** US-007 (v2.4), US-009 (v2.4)  
**Estimativa:** 2 pts  
**Dependências:** TASK-121

### Subtasks
- [x] Criar `sendWaitingPaymentNotification(storeId, orderId, userId, ip)` em `orders.service.ts`
  - Validação tenant isolation (storeId)
  - Validação `order.type === 'DELIVERY'` (400 para retirada)
  - Validação `order.status === 'PENDING'` (400 para outros status)
  - Fire-and-forget WhatsApp via `sendStatusUpdateMessage(... 'WAITING_PAYMENT' ...)`
  - Sem mudança de status (pedido mantém PENDING na coluna "Novos")
  - AuditLog: `order.send_waiting_payment`
- [x] Criar controller `sendWaitingPaymentController` em `orders.controller.ts`
- [x] Registrar rota `PATCH /:id/send-waiting-payment` em `orders.routes.ts`
- [x] Testes unitários: 6 casos em `orders.service.test.ts` (200, 404, tenant, 400 pickup, 400 non-pending, auditLog, sem update de status)

### Critérios de Done
- [x] Endpoint retorna 200 para DELIVERY + PENDING
- [x] Não muda status (sem migration necessária)
- [x] Dispara mensagem WhatsApp WAITING_PAYMENT
- [x] Retorna 400 para pedidos de retirada
- [x] Tenant isolation validado

---

### TASK-124: UI — Botão "Enviar Aguardando Pix" no OrderCard ✅

**Epic:** 12  
**Story:** US-009 (v2.4)  
**Estimativa:** 1 pt  
**Dependências:** TASK-123

### Subtasks
- [x] Adicionar `sendWaitingPayment(id)` em `orders.service.ts` (frontend)
- [x] Adicionar `useSendWaitingPayment()` hook em `useOrders.ts`
- [x] Botão condicional no `OrderCard` em `OrdersPage.tsx`:
  - Visível somente quando `order.status === 'PENDING'` AND `order.type === 'DELIVERY'`
  - Label: "Enviar Aguardando Pix" com ícone `Clock`
  - Cor âmbar (destaque sem ser ação primária)
- [x] Estado loading: botão desabilitado com "Enviando..."
- [x] `onSuccess`: invalida queries de orders

### Critérios de Done
- [x] Botão visível apenas em cards DELIVERY + PENDING
- [x] Botão ausente em pedidos de retirada
- [x] Clique envia requisição e invalida cache
- [x] Feedback visual funcional (loading state)

---

## Fase 3 — UI: Kanban v2

### TASK-125: UI — Adicionar coluna "Confirmado" ao Kanban ✅

**Epic:** 12  
**Story:** US-009 (v2.4)  
**Estimativa:** 3 pts  
**Dependências:** TASK-121

### Subtasks
- [x] Adicionar coluna `confirmado` entre `novos` e `em_preparo` em `ACTIVE_COLUMN_CONFIG`
- [x] Status `CONFIRMED` mapeado exclusivamente para coluna "Confirmado" (removido de "Em preparo")
- [x] Coluna "Em preparo" agora contém apenas `PREPARING`
- [x] `NEXT_STATUS` mantém `CONFIRMED → PREPARING` (botão "→" avança para Em preparo)
- [x] Ao avançar para CONFIRMED: backend dispara WhatsApp "Pedido confirmado" (via TASK-121)
- [x] Ícone: `CheckCheck` (lucide), cor roxo/purple

### Critérios de Done
- [x] Coluna "Confirmado" visível entre "Novo" e "Em Preparo" no Kanban
- [x] Pedidos com status CONFIRMED aparecem nesta coluna
- [x] Mover para Confirmado → mensagem WhatsApp disparada (via backend)
- [x] Botão "→" avança para Em Preparo
- [x] Sem regressão no fluxo de retirada

---

### TASK-126: UI — Seção "Cancelados" no Kanban ✅

**Epic:** 12  
**Story:** US-009 (v2.4)  
**Estimativa:** 2 pts  
**Dependências:** TASK-122

### Subtasks
- [x] Implementar tabs "Ativos | Cancelados" na barra de ações superior
- [x] Tab "Cancelados" mostra pedidos do dia com status CANCELLED via `CancelledSection`
- [x] `CANCELLED` removido da coluna "Concluídos" (agora isolado)
- [x] Cards na seção Cancelados são **readonly** (apenas "Ver detalhes")
- [x] Badge vermelho com contagem de cancelados no botão da tab
- [x] Filtros de data e tipo aplicados também à seção Cancelados
- [x] Pedido cancelado → aparece em tempo real via polling (5s)

### Critérios de Done
- [x] Seção "Cancelados" visível e acessível via tab
- [x] Cancelar pedido → move para seção em tempo real (polling)
- [x] Cards readonly (sem ação de avançar status)
- [x] Badge de contagem exibido

---

## Fase 4 — QA

### TASK-127: Testes — Cobertura do Epic 12 ✅

**Epic:** 12  
**Story:** US-007 (v2.4), US-009 (v2.4)  
**Estimativa:** 2 pts  

### Arquivos de teste criados/modificados
- [x] **NOVO** `api/src/modules/admin/__tests__/whatsapp-messages-fallback.test.ts` — 11 testes
  - `getTemplate` fallback para todos os 11 event types
  - `sendStatusUpdateMessage` envia para CONFIRMED, PREPARING, DISPATCHED, DELIVERED, CANCELLED, WAITING_PAYMENT
  - `READY → READY_FOR_PICKUP` para PICKUP
  - `READY` para DELIVERY → sem mensagem (motoboy cuida)
  - Substituição de variáveis `{{numero}}` e `{{loja}}`
  - Template customizado tem prioridade
- [x] **MODIFICADO** `api/src/modules/admin/__tests__/orders.service.test.ts`
  - Atualizado: `PENDING → CONFIRMED` agora permitido (era teste que esperava 422)
  - Adicionado: CANCELLED dispara `sendStatusUpdateMessage`
  - Adicionado: `cancelledAt` timestamp persistido ao cancelar
  - Adicionado: 6 testes para `sendWaitingPaymentNotification`

### Critérios de Done
- [x] Todos os 11 eventos cobertos por testes de fallback
- [x] sendWaitingPaymentNotification: 6 testes (200, 404×2, 400 pickup, 400 non-pending, auditLog, sem update)
- [x] CANCELLED: disparo verificado
- [x] Zero regressão em testes existentes (transição PENDING→CONFIRMED atualizada)

---

## Checklist Pré-Release (Sprint 18)

- [x] Loja sem template configurado envia mensagem padrão
- [x] Modo WHATSAPP básico envia todos os status automáticos
- [x] Coluna "Confirmado" visível no Kanban entre Novos e Em preparo
- [x] Mover para "Confirmado" dispara mensagem WhatsApp (via backend)
- [x] Seção "Cancelados" visível via tab no Kanban
- [x] Cancelar pedido dispara mensagem WhatsApp e move card para tab Cancelados
- [x] Botão "Enviar Aguardando Pix" aparece somente em pedidos de entrega
- [x] Botão "Enviar Aguardando Pix" ausente em pedidos de retirada
- [x] Clique no botão envia WhatsApp (sem mudar status)
- [x] Motoboy designado dispara mensagem MOTOBOY_ASSIGNED (existente, confirmado)
- [ ] GREETING dispara no primeiro contato do dia (Epic 10 — Sprint 15-16)
- [ ] ABSENCE dispara fora do horário configurado (Epic 10 — Sprint 15-16)
- [x] 11 templates padrão todos funcionais como fallback

---

## Resumo de Arquivos Modificados

### Backend
| Arquivo | Tipo | O que mudou |
|---|---|---|
| `api/src/modules/whatsapp/messages.service.ts` | Fix | READY→READY_FOR_PICKUP para PICKUP; orderType param adicionado |
| `api/src/modules/admin/orders.service.ts` | Fix+Feature | PENDING→CONFIRMED em STATUS_TRANSITIONS; orderType passado; sendWaitingPaymentNotification adicionado |
| `api/src/modules/admin/orders.controller.ts` | Feature | sendWaitingPaymentController adicionado |
| `api/src/modules/admin/orders.routes.ts` | Feature | PATCH /:id/send-waiting-payment registrado |

### Frontend
| Arquivo | Tipo | O que mudou |
|---|---|---|
| `web/src/modules/admin/services/orders.service.ts` | Feature | sendWaitingPayment() adicionado |
| `web/src/modules/admin/hooks/useOrders.ts` | Feature | useSendWaitingPayment() adicionado |
| `web/src/modules/admin/pages/OrdersPage.tsx` | Feature | Coluna Confirmado; Seção Cancelados; Botão Aguardando Pix; 5 colunas Kanban |

### Testes
| Arquivo | Tipo | Testes |
|---|---|---|
| `api/src/modules/admin/__tests__/whatsapp-messages-fallback.test.ts` | NOVO | 11 testes |
| `api/src/modules/admin/__tests__/orders.service.test.ts` | MODIFICADO | +8 testes, 1 atualizado |
