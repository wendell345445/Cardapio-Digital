# Epic 09 — WhatsApp Mode + Auth Session + Sprint 14

**Sprint:** 14  
**Data:** 2026-04-07  
**Origem:** Spec v2.1 — 7 mudanças solicitadas pelo cliente (Uendell)  
**Referência:** `.specify/changelog/v2.1-migration.md`  
**Total Story Points:** 53 pts  
**Total Tasks:** 12

---

## Visão Geral do Epic

Implementar as 7 mudanças da spec v2.1, organizadas em 4 fases por ordem de risco e dependência:

| Fase | Foco | Tasks | Pts |
|---|---|---|---|
| 1 | Bugfixes (baixo risco, impacto imediato) | TASK-091 → TASK-094 | 8 pts |
| 2 | Schema DB + APIs | TASK-095 → TASK-097 | 11 pts |
| 3 | UI Features | TASK-098 → TASK-0910 | 16 pts |
| 4 | AI Pipeline + Testes E2E | TASK-0911 → TASK-0912 | 18 pts |

---

## FASE 1 — Bugfixes

---

## TASK-091: Sidebar Admin — Item WhatsApp + Badge de Status

**Epic:** 09-WhatsApp-Auth  
**Story:** MUDANÇA 2 — WhatsApp sync visível no dashboard/sidebar  
**Estimativa:** 2 story points  
**Dependências:** Nenhuma (bugfix isolado)  
**Tipo:** Bugfix

### Descrição
`WhatsAppPage.tsx` existe e funciona em `/admin/whatsapp` mas não está acessível pela sidebar. Adicionar item de navegação e badge de status de conexão.

### Subtasks
- [ ] Abrir `src/modules/admin/components/AdminSidebar.tsx` e localizar array `NAV_ITEMS`
- [ ] Adicionar item após `QrCode`: `{ label: 'WhatsApp', to: '/admin/whatsapp', icon: MessageCircle }`
- [ ] Importar `MessageCircle` de `lucide-react`
- [ ] Adicionar badge de status: verde se conectado, vermelho se desconectado (consumir `/admin/whatsapp/qrcode` status)
- [ ] Verificar que a rota `/admin/whatsapp` já existe em `App.tsx` (senão adicionar)

### Critérios de Aceitação
- [ ] Item "WhatsApp" visível na sidebar admin
- [ ] Clique navega para `/admin/whatsapp`
- [ ] Badge exibe status de conexão correto
- [ ] Ícone `MessageCircle` renderiza sem erro

### Testes Obrigatórios
- [ ] E2E: clicar "WhatsApp" na sidebar → navega para `/admin/whatsapp`

### Arquivos Modificados
- `src/modules/admin/components/AdminSidebar.tsx`
- `src/App.tsx` (verificar/adicionar rota se ausente)

### Tempo Estimado
30-45 min

---

## TASK-092: Botão Logout — Admin Sidebar + Owner Layout

**Epic:** 09-WhatsApp-Auth  
**Story:** MUDANÇA 5 — Botão de logout no painel Admin e Owner  
**Estimativa:** 2 story points  
**Dependências:** Nenhuma  
**Tipo:** Bugfix

### Descrição
`useAuthStore.ts` já tem `logout()` e `auth.service.ts` tem `logout(refreshToken)`. O motoboy já tem botão funcionando. Falta apenas adicionar nos layouts Admin e Owner.

### Subtasks
- [ ] Em `AdminSidebar.tsx`: adicionar botão "Sair" no footer abaixo do avatar
  - Importar `LogOut` de `lucide-react`
  - Importar `useNavigate` de `react-router-dom`
  - Importar `logout` de `@/modules/auth/services/auth.service`
  - Implementar `handleLogout()`: chama `auth.service.logout(refreshToken)`, depois `useAuthStore.logout()`, depois `navigate('/login')`
  - **Atenção:** o refresh token virá de `sessionStorage` após TASK-093 (mas neste ponto ainda é `localStorage`)
- [ ] Em Owner layout (`DashboardPage.tsx` ou criar `OwnerLayout.tsx`): adicionar botão/link "Sair" no header
- [ ] Verificar que `MotoboyPage.tsx` tem o mesmo padrão (referência)

### Critérios de Aceitação
- [ ] Botão "Sair" visível no footer da sidebar admin
- [ ] Botão "Sair" visível no header do painel owner
- [ ] Clicar "Sair" chama `POST /api/v1/auth/logout` com refreshToken
- [ ] Após logout: auth store limpo, redireciona para `/login`
- [ ] Erro na chamada de logout não bloqueia o fluxo (catch vazio)

### Testes Obrigatórios
- [ ] E2E: clicar "Sair" na sidebar admin → redireciona para `/login`
- [ ] E2E: clicar "Sair" no owner → redireciona para `/login`
- [ ] Integração: `POST /auth/logout` invalida refresh token

### Arquivos Modificados
- `src/modules/admin/components/AdminSidebar.tsx`
- `src/modules/owner/pages/DashboardPage.tsx` (ou layout owner)

### Tempo Estimado
1-1.5h

---

## TASK-093: Migrar Auth Storage — localStorage → sessionStorage

**Epic:** 09-WhatsApp-Auth  
**Story:** MUDANÇA 6 — Auth por session (tab independente)  
**Estimativa:** 3 story points  
**Dependências:** TASK-092 deve ser feita antes (para que o logout use a chave correta)  
**Tipo:** Bugfix / Breaking Change

### Descrição
Trocar o storage do Zustand persist e de todos os `localStorage` de auth para `sessionStorage`. Isso torna cada tab do browser uma sessão independente. **Breaking change UX:** usuário perde sessão ao fechar a tab.

### Subtasks
- [ ] **`useAuthStore.ts`**: trocar storage de `localStorage` para `sessionStorage`
  ```typescript
  import { createJSONStorage } from 'zustand/middleware'
  storage: createJSONStorage(() => sessionStorage)
  ```
- [ ] **`useLogin.ts`**: trocar `localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)` → `sessionStorage.setItem`
- [ ] **`useOAuthCallback.ts`**: trocar `localStorage.setItem(REFRESH_TOKEN_KEY, refresh)` → `sessionStorage.setItem`
- [ ] **`api.ts`** (interceptor de refresh): buscar refresh token de `sessionStorage` em vez de `localStorage`
- [ ] **`MotoboyPage.tsx`**: trocar 4 ocorrências (`token`, `storeId` set/remove) para `sessionStorage`
- [ ] Verificar outros arquivos que leem `REFRESH_TOKEN_KEY` ou `'auth_refresh_token'` via grep
- [ ] **Após TASK-093**, atualizar `handleLogout()` de TASK-092 para ler de `sessionStorage`

### Critérios de Aceitação
- [ ] Logar em Tab 1 como admin A, abrir Tab 2 → Tab 2 não está logada (pede login)
- [ ] Logar em Tab 1 como admin A e Tab 2 como admin B → ambas funcionam simultaneamente
- [ ] Fechar e reabrir a tab → precisa logar novamente (comportamento esperado)
- [ ] Refresh token interceptor funciona corretamente (não usa localStorage mais)
- [ ] Grep por `localStorage` em módulos auth retorna zero ocorrências relevantes

### Grep de Verificação
```bash
grep -r "localStorage" src/modules/auth/ src/modules/motoboy/
grep -r "REFRESH_TOKEN_KEY" src/
```

### Testes Obrigatórios
- [ ] Unitário: `useAuthStore` persiste em `sessionStorage`, não `localStorage`
- [ ] E2E: abrir 2 tabs, logar com users diferentes, verificar independência

### Arquivos Modificados
- `src/modules/auth/stores/useAuthStore.ts`
- `src/modules/auth/hooks/useLogin.ts`
- `src/modules/auth/hooks/useOAuthCallback.ts`
- `src/lib/api.ts` (interceptor)
- `src/modules/motoboy/pages/MotoboyPage.tsx`

### Tempo Estimado
1-1.5h

---

## TASK-094: Fix Link "Admins Adicionais" Quebrado (Guard + Placeholder)

**Epic:** 09-WhatsApp-Auth  
**Story:** MUDANÇA 7 — Rota "Admins adicionais" quebrada → logout forçado  
**Estimativa:** 1 story point  
**Dependências:** Nenhuma  
**Tipo:** Bugfix (fix imediato — feature completa em TASK-0910)

### Descrição
Existe um link em algum lugar apontando para rota inexistente `/admin/admins` ou `/owner/stores/:id/admins`. Isso dispara 401 → AuthGuard → logout forçado. Investigar, corrigir o link e adicionar placeholder "Em breve" até TASK-0910 implementar a feature.

### Subtasks
- [ ] Grep para localizar o link quebrado:
  ```bash
  grep -r "admins" src/ --include="*.tsx" --include="*.ts"
  ```
- [ ] Identificar em qual componente está o link (`DashboardPage`, `StoreDetailPage`, ou outro)
- [ ] Opção A: remover o link temporariamente
- [ ] Opção B: substituir por texto estático "Admins (Em breve)" sem navegação
- [ ] Verificar que clicar no local não mais dispara logout
- [ ] Verificar que não há rota `/admin/admins` sem guard adequado em `App.tsx`

### Critérios de Aceitação
- [ ] Navegar pelo painel owner/admin sem ser deslogado involuntariamente
- [ ] Link problemático removido ou substituído por placeholder
- [ ] Zero chamadas 401 por rota inexistente nos logs de rede

### Testes Obrigatórios
- [ ] E2E: navegar por todas as páginas do painel owner → nenhum logout inesperado
- [ ] E2E: acessar `/owner/stores/:id` → não ocorre redirecionamento para `/login`

### Arquivos Modificados
- A definir após investigação (provavelmente `StoreDetailPage.tsx` ou `DashboardPage.tsx`)

### Tempo Estimado
30min

---

## FASE 2 — Schema DB + APIs

---

## TASK-095: Migration DB — WhatsAppMode + WhatsAppTemplate + AIInteractionLog

**Epic:** 09-WhatsApp-Auth  
**Story:** MUDANÇAS 1, 3 e 4 — Schema base para todas as features v2.1  
**Estimativa:** 3 story points  
**Dependências:** Fase 1 concluída (nenhum bloqueio técnico, mas bom ter o ambiente estável)  
**Tipo:** Feature (DB)

### Descrição
Adicionar os 3 novos elementos de schema: enum `WhatsAppMode` no modelo `Store`, tabela `WhatsAppTemplate` e tabela `AIInteractionLog`.

### Subtasks
- [ ] Abrir `prisma/schema.prisma`
- [ ] Adicionar enum `WhatsAppMode { WHATSAPP  WHATSAPP_AI }`
- [ ] Adicionar campo `whatsappMode WhatsAppMode @default(WHATSAPP)` no modelo `Store`
- [ ] Adicionar enum `WhatsAppEventType` com 9 valores (ORDER_CREATED, WAITING_PAYMENT, CONFIRMED, PREPARING, DISPATCHED, READY_FOR_PICKUP, DELIVERED, CANCELLED, MOTOBOY_ASSIGNED)
- [ ] Adicionar modelo `WhatsAppTemplate` com relação ao `Store` (storeId, eventType, template, timestamps, @@unique([storeId, eventType]), @@index([storeId]))
- [ ] Adicionar `whatsappTemplates WhatsAppTemplate[]` no modelo `Store`
- [ ] Adicionar modelo `AIInteractionLog` (storeId, clientPhone, question, sqlGenerated?, response, success, latencyMs?, createdAt, @@index([storeId, createdAt]))
- [ ] Rodar: `npx prisma migrate dev --name add-whatsapp-mode-templates-ai-log`
- [ ] Verificar que lojas existentes recebem `whatsappMode = WHATSAPP` (default — automático)

### Critérios de Aceitação
- [ ] Migration roda sem erro em dev e staging
- [ ] `prisma studio` exibe as novas tabelas/campos
- [ ] Lojas existentes têm `whatsappMode = 'WHATSAPP'`
- [ ] `@@unique([storeId, eventType])` impede duplicação de template

### Testes Obrigatórios
- [ ] Integração: criar Store → `whatsappMode` default é `WHATSAPP`
- [ ] Integração: criar `WhatsAppTemplate` com mesmo `(storeId, eventType)` duas vezes → erro de constraint

### Comandos
```bash
npx prisma migrate dev --name add-whatsapp-mode-templates-ai-log
npx prisma generate
npx prisma studio  # verificar visualmente
```

### Arquivos Modificados
- `prisma/schema.prisma`
- `prisma/migrations/` (gerado automaticamente)

### Tempo Estimado
1.5-2h

---

## TASK-096: API — WhatsApp Mode na Criação e Edição de Loja

**Epic:** 09-WhatsApp-Auth  
**Story:** MUDANÇA 1 — WhatsApp Mode por loja  
**Estimativa:** 3 story points  
**Dependências:** TASK-095  
**Tipo:** Feature (API)

### Descrição
Atualizar os endpoints de criação e edição de loja para aceitar e validar o campo `whatsappMode`. Aplicar regra de negócio: `WHATSAPP_AI` requer `plan = PREMIUM`; downgrade automático se plano for rebaixado.

### Subtasks
- [ ] Localizar `POST /api/v1/owner/stores` no controller de stores (owner)
- [ ] Adicionar `whatsappMode` ao schema Zod de validação (opcional, default `WHATSAPP`)
- [ ] Aplicar RN: se `whatsappMode === 'WHATSAPP_AI'` e `plan !== 'PREMIUM'` → retornar `400` com mensagem clara
- [ ] Localizar `PUT /api/v1/owner/stores/:id` e aplicar mesma validação
- [ ] Localizar `PUT /api/v1/owner/stores/:id/plan` (downgrade de plano): se novo plano for `PROFESSIONAL` → setar `whatsappMode = 'WHATSAPP'` automaticamente
- [ ] `GET /api/v1/owner/stores/:id` — garantir que `whatsappMode` é retornado na resposta
- [ ] Em `whatsapp/ai-handler.service.ts`: adicionar check `if (store.whatsappMode !== 'WHATSAPP_AI') return` no início do handler

### Critérios de Aceitação
- [ ] `POST /owner/stores` com `whatsappMode: 'WHATSAPP_AI'` e `plan: 'PREMIUM'` → 201 OK
- [ ] `POST /owner/stores` com `whatsappMode: 'WHATSAPP_AI'` e `plan: 'PROFESSIONAL'` → 400 Bad Request
- [ ] Downgrade de plano para PROFESSIONAL → `whatsappMode` rebaixa para `WHATSAPP`
- [ ] `GET /owner/stores/:id` retorna `whatsappMode` no body

### Testes Obrigatórios
- [ ] Unitário: validação `WHATSAPP_AI` exige `PREMIUM`
- [ ] Integração: criação de loja com `whatsappMode = WHATSAPP_AI` e plano correto
- [ ] Integração: downgrade de plano rebaixa `whatsappMode`

### Arquivos Modificados
- `src/modules/owner/controllers/stores.controller.ts`
- `src/modules/owner/services/stores.service.ts`
- `src/modules/whatsapp/services/ai-handler.service.ts`

### Tempo Estimado
2h

---

## TASK-097: API — WhatsApp Message Templates (GET/PUT + Refactor messages.service)

**Epic:** 09-WhatsApp-Auth  
**Story:** MUDANÇA 3 — Mensagens WhatsApp: validação + UI de gestão  
**Estimativa:** 5 story points  
**Dependências:** TASK-095  
**Tipo:** Feature (API)

### Descrição
Criar endpoints para ler e salvar templates customizados. Refatorar `messages.service.ts` para buscar template da tabela antes de usar o texto hardcoded. Adicionar mensagem para `WAITING_PAYMENT`.

### Subtasks
- [ ] Criar `GET /api/v1/admin/settings/whatsapp-messages`:
  - Retorna array com todos os 9 `WhatsAppEventType`
  - Para cada event: retorna template customizado (se existir) OU texto default hardcoded
  - Guard: autenticado como ADMIN da loja
- [ ] Criar `PUT /api/v1/admin/settings/whatsapp-messages/:eventType`:
  - Body: `{ template: string }` — validar variáveis permitidas (`{{numero}}`, `{{loja}}`, etc.)
  - Guard: autenticado como ADMIN com `plan === PREMIUM` ou `whatsappMode === WHATSAPP_AI`
  - Upsert: cria ou atualiza `WhatsAppTemplate` para `(storeId, eventType)`
- [ ] Refatorar `messages.service.ts`:
  - Criar método `getTemplate(storeId, eventType)`: busca `WhatsAppTemplate` no banco; se não existe, retorna default hardcoded
  - Substituir todas as strings hardcoded por chamada a `getTemplate()`
  - Adicionar `sendWaitingPaymentMessage()` para o status `WAITING_PAYMENT`
- [ ] Definir e documentar os defaults hardcoded para todos os 9 eventos (pode ser objeto const no próprio service)

### Critérios de Aceitação
- [ ] `GET /admin/settings/whatsapp-messages` retorna 9 eventos com templates (custom ou default)
- [ ] `PUT` com Plano 1 → 403 Forbidden
- [ ] `PUT` com Plano 2 → salva template e retorna o template salvo
- [ ] Template customizado é usado no próximo envio de mensagem
- [ ] Fallback para default se template não existir no banco
- [ ] Status `WAITING_PAYMENT` dispara mensagem WhatsApp

### Testes Obrigatórios
- [ ] Unitário: `getTemplate()` retorna default quando banco está vazio
- [ ] Unitário: `getTemplate()` retorna custom quando existe no banco
- [ ] Integração: salvar template customizado → verificar que envio usa texto correto
- [ ] Integração: status `WAITING_PAYMENT` dispara mensagem via `sendWaitingPaymentMessage()`

### Arquivos Modificados
- `src/modules/admin/controllers/settings.controller.ts`
- `src/modules/whatsapp/services/messages.service.ts`
- `src/modules/admin/routes/settings.routes.ts`

### Tempo Estimado
3h

---

## FASE 3 — UI Features

---

## TASK-098: UI — Campo whatsappMode em NewStorePage + StoreDetailPage

**Epic:** 09-WhatsApp-Auth  
**Story:** MUDANÇA 1 — WhatsApp Mode por loja  
**Estimativa:** 3 story points  
**Dependências:** TASK-096  
**Tipo:** Feature (Frontend)

### Descrição
Adicionar seleção de `whatsappMode` no formulário de criação de loja e na página de detalhes (edição). Usar radio buttons ou Select com duas opções.

### Subtasks
- [ ] Abrir `src/modules/owner/pages/NewStorePage.tsx`
- [ ] Adicionar campo `whatsappMode` no schema Zod do formulário (React Hook Form)
- [ ] Adicionar componente radio/select:
  - Opção "WhatsApp" (value: `WHATSAPP`) — "Notificações de status automáticas"
  - Opção "WhatsApp com IA" (value: `WHATSAPP_AI`) — "Atendimento inteligente via IA (Plano Premium)"
- [ ] Adicionar validação visual: se `WHATSAPP_AI` selecionado e plano não é Premium → exibir aviso
- [ ] Abrir `src/modules/owner/pages/StoreDetailPage.tsx`
- [ ] Adicionar campo `whatsappMode` na seção de edição da loja
- [ ] Exibir badge informativo: "WhatsApp" (azul) ou "WhatsApp + IA" (roxo) no cabeçalho da loja
- [ ] Verificar feature flag check: usar `store.whatsappMode` além de `store.features.whatsappAI`

### Critérios de Aceitação
- [ ] Formulário de nova loja exibe campo `whatsappMode`
- [ ] Selecionar `WHATSAPP_AI` sem plano Premium mostra aviso
- [ ] `StoreDetailPage` exibe e permite alterar `whatsappMode`
- [ ] Alteração salva via `PUT /owner/stores/:id`

### Testes Obrigatórios
- [ ] Unitário: validação no formulário bloqueia `WHATSAPP_AI` sem Premium
- [ ] E2E: criar loja com WhatsApp IA → loja exibe badge correto

### Arquivos Modificados
- `src/modules/owner/pages/NewStorePage.tsx`
- `src/modules/owner/pages/StoreDetailPage.tsx`

### Tempo Estimado
2h

---

## TASK-099: UI — Aba "Mensagens WhatsApp" em SettingsPage

**Epic:** 09-WhatsApp-Auth  
**Story:** MUDANÇA 3 — Mensagens WhatsApp: validação + UI de gestão  
**Estimativa:** 5 story points  
**Dependências:** TASK-097  
**Tipo:** Feature (Frontend)

### Descrição
Adicionar aba "Mensagens" na `SettingsPage`. Para Plano 1: preview somente leitura. Para Plano 2: campos editáveis para cada evento WhatsApp.

### Subtasks
- [ ] Abrir `src/modules/admin/pages/SettingsPage.tsx`
- [ ] Adicionar tab `mensagens` na lista de tabs existentes (dados, horarios, pagamentos, motoboys, acesso)
- [ ] Criar componente `WhatsAppMessagesTab.tsx`:
  - Buscar templates via `GET /admin/settings/whatsapp-messages`
  - Exibir lista de 9 eventos (label amigável + template atual)
  - Para Plano 1: textarea readonly com lock icon e tooltip "Edição disponível no Plano Premium"
  - Para Plano 2/WHATSAPP_AI: textarea editável + botão "Salvar" por evento
  - Preview com substituição de variáveis: ex. `{{loja}}` → nome da loja real
  - Exibir quais variáveis estão disponíveis: `{{numero}}`, `{{loja}}`, `{{status}}`, `{{itens}}`, `{{total}}`
- [ ] Implementar `handleSaveTemplate(eventType, template)` → `PUT /admin/settings/whatsapp-messages/:eventType`
- [ ] Toast de sucesso/erro após salvar

### Critérios de Aceitação
- [ ] Tab "Mensagens" visível em Configurações
- [ ] Plano 1: templates visíveis, editáveis bloqueados com indicação
- [ ] Plano 2: editar e salvar template → feedback visual de sucesso
- [ ] Preview substitui variáveis com dados reais da loja
- [ ] 9 eventos listados com labels legíveis em português

### Testes Obrigatórios
- [ ] Unitário: preview substitui variáveis corretamente
- [ ] E2E: admin Plano 2 edita template → próxima mensagem usa texto customizado

### Arquivos Criados
- `src/modules/admin/components/WhatsAppMessagesTab.tsx`

### Arquivos Modificados
- `src/modules/admin/pages/SettingsPage.tsx`

### Tempo Estimado
3h

---

## TASK-0910: API + UI — Admins Adicionais por Loja

**Epic:** 09-WhatsApp-Auth  
**Story:** MUDANÇA 7 — US-001C Admins Adicionais por Loja  
**Estimativa:** 8 story points  
**Dependências:** TASK-094 (fix do link quebrado)  
**Tipo:** Feature (Full-stack)

### Descrição
Implementar o CRUD completo de admins adicionais por loja. Owner pode adicionar, listar e remover admins. Máximo 5 admins por loja. Não pode remover o admin original.

### Subtasks

**API:**
- [ ] Criar `GET /api/v1/owner/stores/:id/admins` — lista admins da loja (role ADMIN com storeId)
- [ ] Criar `POST /api/v1/owner/stores/:id/admins` — cria usuário com role ADMIN:
  - Body: `{ name, email, password }` (validar com Zod)
  - Verificar limite: máximo 5 admins por loja
  - Hash da senha com bcrypt
  - Vincular ao `storeId` correto
- [ ] Criar `DELETE /api/v1/owner/stores/:id/admins/:userId` — remove admin:
  - RN: não pode remover o `primaryAdminId` da loja (ou o primeiro admin criado)
  - Retornar 403 se tentar remover o admin original
- [ ] Guard: todas as rotas exigem autenticação como Owner

**Frontend:**
- [ ] Em `StoreDetailPage.tsx`: adicionar tab "Admins" à lista de tabs
- [ ] Criar componente `StoreAdminsTab.tsx`:
  - Lista de admins com nome, email, data de criação
  - Badge "Admin principal" para o admin original
  - Botão "Remover" (oculto para admin principal)
  - Formulário para adicionar novo admin (nome, email, senha temporária)
  - Contador: "X/5 admins"
- [ ] Rota em `App.tsx`: verificar que `/owner/stores/:id` com tab admins funciona (sem nova rota pública)

### Critérios de Aceitação
- [ ] Owner pode adicionar admin adicional com nome/email/senha
- [ ] Limite de 5 admins exibido e bloqueado ao atingir
- [ ] Admin adicional consegue logar no painel admin da loja normalmente
- [ ] Owner pode remover admins adicionais (exceto o original)
- [ ] Tentar remover admin principal → mensagem de erro clara
- [ ] Rota que antes causava logout agora funciona corretamente

### Testes Obrigatórios
- [ ] Integração: criar admin adicional → login com as credenciais → acessa painel da loja
- [ ] Integração: tentar criar 6° admin → 400 com mensagem de limite
- [ ] Integração: tentar remover admin principal → 403
- [ ] E2E: Owner adiciona admin → admin loga → admin acessa apenas sua loja

### Arquivos Criados
- `src/modules/owner/controllers/store-admins.controller.ts`
- `src/modules/owner/services/store-admins.service.ts`
- `src/modules/owner/pages/components/StoreAdminsTab.tsx`

### Arquivos Modificados
- `src/modules/owner/routes/owner.routes.ts`
- `src/modules/owner/pages/StoreDetailPage.tsx`

### Tempo Estimado
4h

---

## FASE 4 — AI Pipeline + Testes E2E

---

## TASK-0911: AI Pipeline — NLP→SQL em ai-handler.service.ts + Rate Limit Redis

**Epic:** 09-WhatsApp-Auth  
**Story:** MUDANÇA 4 — WhatsApp AI: pipeline NLP → SQL → resposta  
**Estimativa:** 13 story points  
**Dependências:** TASK-095 (AIInteractionLog), TASK-096 (whatsappMode check)  
**Tipo:** Feature (Backend — maior esforço do sprint)

### Descrição
Implementar o pipeline completo de IA: mensagem WhatsApp → Ollama (RunPod) → SQL gerado → executado com segurança → resposta ao cliente. Inclui rate limiting, validação SQL e logging.

### Subtasks

**Pipeline principal (`ai-handler.service.ts`):**
- [ ] Verificar `store.whatsappMode === 'WHATSAPP_AI'` — se não, retornar sem processar
- [ ] Verificar rate limit Redis: chave `ai:rate:{storeId}:{phone}` — máximo 5 mensagens/hora
  - Usar `Bull` ou `ioredis` diretamente com `INCR` + `EXPIRE`
  - Se limite atingido → enviar mensagem de throttle e retornar
- [ ] Montar prompt para Ollama com contexto do cardápio:
  - Buscar produtos, categorias, variações e preços da loja via Prisma
  - Formatar como contexto: "Cardápio da loja {nome}: [lista de produtos com preços]"
  - Instrução ao modelo: "Responda apenas com SQL SELECT válido. Nunca use INSERT, UPDATE, DELETE, DROP"
- [ ] Enviar ao Ollama via RunPod endpoint (`ollama.service.ts`)
  - Timeout: 10 segundos
  - Se timeout → enviar mensagem fallback: "Desculpe, não entendi. Acesse nosso cardápio em {url}"
- [ ] **Validar SQL retornado (CRÍTICO):**
  - Aceitar apenas `SELECT` (regex: `/^SELECT\s/i`)
  - Bloquear: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`
  - Bloquear tabelas de outros tenants: verificar que `storeId = '${storeId}'` está no WHERE
  - Se SQL inválido → fallback + log com `success: false`
- [ ] Executar query via `prisma.$queryRawUnsafe(sql)` (apenas após validação)
- [ ] Formatar resultado como resposta legível em português
- [ ] Enviar resposta ao cliente via `sendMessage(phone, response)`
- [ ] Salvar em `AIInteractionLog`: question, sqlGenerated, response, success, latencyMs

**Rate Limit:**
- [ ] Implementar `checkRateLimit(storeId, phone)`: retorna `{ allowed: boolean, remaining: number }`
- [ ] Implementar `incrementRateLimit(storeId, phone)`: INCR + EXPIRE 3600s no Redis

### Critérios de Aceitação
- [ ] Mensagem "tem pizza sem glúten?" → SQL gerado → resposta correta ao cliente
- [ ] 6ª mensagem no mesmo hora pelo mesmo número → mensagem de throttle
- [ ] SQL com `DELETE` → rejeitado, fallback enviado, log com `success: false`
- [ ] Ollama demora >10s → fallback enviado
- [ ] Query sempre filtrada por `storeId` (nunca vaza dados de outra loja)
- [ ] `AIInteractionLog` registra cada interação

### Testes Obrigatórios
- [ ] Unitário: `validateSQL()` bloqueia INSERT/UPDATE/DELETE/DROP
- [ ] Unitário: `checkRateLimit()` retorna false após 5 mensagens/hora
- [ ] Unitário: validação SQL verifica presença de `storeId` no WHERE
- [ ] Integração: pipeline completo com Ollama mockado (resposta SQL válida → resposta ao cliente)
- [ ] Integração: Ollama mockado com timeout → fallback enviado

### Arquivos Modificados
- `src/modules/whatsapp/services/ai-handler.service.ts`
- `src/modules/whatsapp/services/ollama.service.ts`

### Arquivos Criados
- `src/modules/whatsapp/services/rate-limit.service.ts`
- `src/modules/whatsapp/utils/sql-validator.ts`

### Tempo Estimado
5-6h

---

## TASK-0912: Testes E2E + Integration Suite — Sprint 14

**Epic:** 09-WhatsApp-Auth  
**Story:** Cobertura completa das 7 mudanças v2.1  
**Estimativa:** 5 story points  
**Dependências:** Todas as tasks anteriores concluídas  
**Tipo:** QA

### Descrição
Rodar e completar todos os testes E2E e de integração das 7 mudanças. Verificar checklist de pré-release do changelog v2.1.

### Subtasks
- [ ] E2E: Sidebar admin exibe item "WhatsApp" com badge de status
- [ ] E2E: Logout funciona em Admin (sidebar), Owner (header) e Motoboy (página)
- [ ] E2E: Duas tabs com users diferentes funcionam simultaneamente (sessionStorage)
- [ ] E2E: Fechar tab → reabrir → pede login novamente
- [ ] E2E: Criar loja com `whatsappMode = WHATSAPP_AI` e plano Premium
- [ ] E2E: Downgrade de plano → `whatsappMode` rebaixa para WHATSAPP
- [ ] E2E: Admin Plano 2 edita template WhatsApp → mensagem usa texto customizado
- [ ] E2E: Owner adiciona admin adicional → admin loga → acessa apenas sua loja
- [ ] E2E: Navegar pelo painel Owner sem logout inesperado (fix TASK-094)
- [ ] Integration: 8 eventos WhatsApp disparam mensagens (incluindo WAITING_PAYMENT)
- [ ] Integration: Pipeline IA com Ollama mockado (happy path + timeout + SQL inválido)
- [ ] Verificar checklist completo de `.specify/changelog/v2.1-migration.md` seção "Checklist de Verificação Pré-Release"

### Critérios de Aceitação
- [ ] Todos os testes E2E passando (zero falhas)
- [ ] Todos os testes de integração passando
- [ ] Checklist v2.1 pré-release: 100% marcado
- [ ] Sem regressões nos fluxos existentes (pedidos, cardápio, painel admin)

### Comandos
```bash
npx playwright test --reporter=html  # E2E
npx jest --testPathPattern="sprint14"  # Integration
npx jest --coverage  # verificar cobertura
```

### Tempo Estimado
3h

---

## Resumo Sprint 14

### Story Points por Fase

| Fase | Tasks | Pts | Tempo Est. |
|---|---|---|---|
| 1 — Bugfixes | TASK-091 a TASK-094 | 8 pts | ~3.5h |
| 2 — Schema + API | TASK-095 a TASK-097 | 11 pts | ~7h |
| 3 — UI Features | TASK-098 a TASK-0910 | 16 pts | ~9h |
| 4 — AI + QA | TASK-0911 a TASK-0912 | 18 pts | ~9h |
| **Total** | **12 tasks** | **53 pts** | **~28.5h** |

### Ordem de Execução

```
TASK-091 (sidebar WhatsApp) ──────────────────────────────────┐
TASK-092 (logout admin+owner) ────────────────────────────────┤
TASK-093 (sessionStorage auth) ← depende de TASK-092 concluído┤
TASK-094 (fix link admins) ──────────────────────────────────┘
         ↓
TASK-095 (migration DB)
         ↓
TASK-096 (API whatsappMode) ──── TASK-097 (API templates)
         ↓                                ↓
TASK-098 (UI NewStore+Detail)    TASK-099 (UI SettingsPage)
         ↓
TASK-0910 (Admins adicionais full-stack)
         ↓
TASK-0911 (AI pipeline)
         ↓
TASK-0912 (Testes E2E + QA Final)
```

### Dependências Críticas

- **TASK-093** deve ser executada **após TASK-092** (logout usa refresh token key — precisa estar consistente)
- **TASK-095** é pré-requisito para TASK-096, TASK-097, TASK-0911
- **TASK-096** é pré-requisito para TASK-098
- **TASK-097** é pré-requisito para TASK-099
- **TASK-094** é pré-requisito para TASK-0910

### Breaking Changes a Comunicar

| Mudança | Impacto para usuário |
|---|---|
| `sessionStorage` | Sessão perdida ao fechar tab (esperado) |
| `WhatsAppMode` em Store | Migration obrigatória; lojas existentes = WHATSAPP |
| `WhatsAppTemplate` | Sem breaking change (fallback para hardcoded) |
