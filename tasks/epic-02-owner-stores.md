# Epic 02 — Gestão de Lojas (Owner)

> US-001 (Cadastrar Loja), US-002 (Gerenciar Planos), US-012 (Stripe Billing)

**Total estimado:** 26 story points

---

## TASK-020: Owner — Dashboard e Listagem de Lojas

**Epic:** 02-Owner  
**Story:** US-001  
**Estimativa:** 3 pts  
**Dependências:** TASK-010 (auth), TASK-002 (prisma)

### Subtasks
- [x] Endpoint `GET /api/v1/owner/stores` → lista lojas (nome, slug, plano, status, createdAt)
- [x] Tela `/owner/dashboard` com listagem de lojas (React)
- [x] Filtros: status (TRIAL, ACTIVE, SUSPENDED, CANCELLED)
- [x] Coluna: MRR estimado (total lojas ativas × valor do plano)
- [x] Link para detalhe de cada loja

### Critérios de Done
- [x] Dashboard carrega lista de lojas
- [x] Filtro por status funciona
- [x] Acesso bloqueado para não-OWNER

---

## TASK-021: Owner — Criar Nova Loja

**Epic:** 02-Owner  
**Story:** US-001  
**Estimativa:** 8 pts  
**Dependências:** TASK-020, TASK-030 (Stripe)

### Subtasks
- [x] Endpoint `POST /api/v1/owner/stores` com schema Zod:
  - nome, slug (alfanumérico, único globalmente), plano, email do admin, telefone WhatsApp (11 dígitos BR)
- [x] Validações: slug único (RN-001), **slug não reservado (RN-001C — `api`, `www`, `admin`, …)**, email não cadastrado em outra loja (RN-002), WhatsApp 11 dígitos (RN-003)
- [x] Criar registro `Store` com UUID (storeId)
- [x] Criar `User` com role `ADMIN` + senha temporária bcrypt
- [x] Criar `Stripe Customer` + `Subscription` via Stripe API
- [x] Salvar `stripeCustomerId` e `stripeSubscriptionId` na Store
- [x] Enviar email de boas-vindas com senha temporária e link de ativação
- [x] Criar `BusinessHour` padrão (Seg-Dom, 18h-23h) para a loja
- [x] Criar `StoreFeatures` conforme plano selecionado
- [x] Formulário React em `/owner/stores/new`
- [x] Registro no AuditLog da criação

### Critérios de Done
- [x] Loja criada com storeId UUID
- [x] Admin recebe email em <5 min (ou log de envio confirmado)
- [x] Stripe Customer + Subscription criados
- [x] Feature flags corretas conforme plano
- [x] Slug inválido retorna erro 422
- [x] Email duplicado retorna erro 422
- [x] Unit: validação de slug, validação de WhatsApp
- [x] Integration: criação de Store + User + Stripe (mocked)
- [x] E2E: owner cria loja → admin recebe email (com Mailhog local)

---

## TASK-022: Owner — Detalhes e Edição de Loja

**Epic:** 02-Owner  
**Story:** US-001  
**Estimativa:** 3 pts  
**Dependências:** TASK-021

### Subtasks
- [x] Endpoint `GET /api/v1/owner/stores/:id` → detalhes da loja
- [x] Endpoint `PATCH /api/v1/owner/stores/:id` → editar nome, descrição, status
- [x] Tela `/owner/stores/:id` com formulário de edição
- [x] Endpoint `DELETE /api/v1/owner/stores/:id` → cancelar loja (status CANCELLED)
- [x] Toda ação de Owner em loja específica → AuditLog

### Critérios de Done
- [x] Detalhes da loja exibidos corretamente
- [x] Edição salva e reflete no dashboard
- [x] Cancelamento muda status para CANCELLED (não deleta dados)

---

## TASK-023: Owner — Gerenciar Planos (Upgrade/Downgrade)

**Epic:** 02-Owner  
**Story:** US-002  
**Estimativa:** 5 pts  
**Dependências:** TASK-022, TASK-030 (Stripe)

### Subtasks
- [x] Endpoint `PATCH /api/v1/owner/stores/:id/plan` → muda plano
- [x] Atualizar `Subscription` no Stripe com novo plano
- [x] Atualizar `StoreFeatures` conforme novo plano
- [x] Notificar Admin da loja via email sobre mudança de plano
- [x] Registrar histórico de mudança de plano no AuditLog
- [x] UI: botão "Alterar Plano" com seletor no detalhe da loja

### Critérios de Done
- [x] Upgrade para Premium ativa feature flags corretas
- [x] Downgrade para Profissional desativa feature flags Premium
- [x] Email enviado ao admin da loja
- [x] Histórico de mudanças consultável

---

## TASK-024: Owner — Audit Logs por Loja

**Epic:** 02-Owner  
**Story:** US-001  
**Estimativa:** 2 pts  
**Dependências:** TASK-021

### Subtasks
- [x] Endpoint `GET /api/v1/owner/stores/:id/audit-logs` com paginação
- [x] Tela de audit logs na interface Owner
- [x] Filtros: data, ação, usuário

### Critérios de Done
- [x] Audit logs listados com paginação (cursor-based ou offset)
- [x] Filtros funcionando

---

## TASK-030: Stripe — Integração Base e Webhooks

**Epic:** 02-Owner  
**Story:** US-012  
**Estimativa:** 13 pts  
**Dependências:** TASK-010

### Subtasks
- [x] `npm install stripe`
- [x] Configurar Stripe SDK com `STRIPE_SECRET_KEY`
- [x] Criar produtos e preços no Stripe Dashboard (PROFESSIONAL R$99, PREMIUM R$149)
- [x] Implementar `createCustomer(email, name)` 
- [x] Implementar `createSubscription(customerId, planPriceId)`
- [x] Implementar `updateSubscription(subscriptionId, newPlanPriceId)`
- [x] Implementar webhook handler `POST /api/v1/webhooks/stripe`:
  - `payment_intent.succeeded` → marcar loja como ACTIVE
  - `invoice.payment_failed` → iniciar contagem de carência (3 dias)
  - `customer.subscription.updated` → atualizar plano e feature flags
  - `customer.subscription.deleted` → suspender loja
- [x] Validar signature do webhook (`stripe.webhooks.constructEvent`)
- [x] Lógica de suspensão: após 3 dias de `payment_failed` sem regularização → Store.status = SUSPENDED
- [x] Reativação: `payment_intent.succeeded` → Store.status = ACTIVE
- [x] Quando suspenso: cardápio público exibe "No momento não estamos operando online"
- [x] Email de notificação ao Admin se pagamento falhar

### Critérios de Done
- [x] Webhook recebe e processa eventos Stripe (testado com Stripe CLI)
- [x] Loja suspendia após 3 dias de falha
- [x] Loja reativada após pagamento
- [x] Signature inválida retorna 400
- [x] Integration: webhook events mockados com Stripe CLI
