# Epic 13 — Auto-cadastro Público + Trial Stripe 7d + Login Social Opt-in

> US-001B (novo), US-001A (renomeação de US-001), US-014 (Auth)
> Ref: `.specify/changelog/v2.5-migration.md`

**Sprint:** 19 (tasks originais) + Patch v2.5.2 (Fase 7, hardening) + Patch v2.5.3 (Fase 8, dev tool)
**Total estimado:** ~34 story points (23 originais + 9 do patch + 2 do dev tool)
**Total tasks:** 24 (16 originais + 7 Fase 7 + 1 Fase 8)
**Status:** ✅ CONCLUÍDO — Fase 1-6 em 2026-04-10 / Fase 7 (hardening) em 2026-04-10 / Fase 8 (dev tool) em 2026-04-10
**Contexto:** Cliente (Uendell) solicitou self-service público com trial Stripe 7d sem cartão (`/cadastro`), email de boas-vindas (sem WhatsApp), padronização das ENVs OAuth (`GOOGLE_CLIENT_ID/SECRET` → `GOOGLE_APP_ID/SECRET`) e flags de habilitação por ambiente (`*_APP_ENABLE`). Botões sociais ficam **opt-in** e somente na tela de login — cadastro é **só formulário** (12 campos com endereço completo via ViaCEP).

**Fase 7 (Patch v2.5.2):** hardening pós-trial identificado em análise — trial no Price (não no código), `STRIPE_GRACE_PERIOD_DAYS` configurável, webhook `trial_will_end`, cron de suspensão Bull, Stripe Customer Portal (backend + UI), logging estruturado Pino, cards de seleção de plano no cadastro.

**Fase 8 (Patch v2.5.3 → v2.5.8):** ação "Encerrar trial agora" — botão amarelo no `StoreDetailPage` do Owner que dispara `subscriptions.update(sub, { trial_end: 'now' })` no Stripe + sweep imediato no Bull, permitindo validar o ciclo completo trial → `invoice.payment_failed` → `SUSPENDED` → email em ~10s sem esperar 7 dias. Inclui novo email `trial-suspended.html` (também enviado em produção pelo cron de suspensão — antes ninguém era notificado da suspensão). Originalmente gated como dev tool via `isDevToolsEnabled()` + `ENABLE_TRIAL_DEV_TOOLS`; em v2.5.8 o gating foi removido e a feature promovida a ação operacional permanente do Owner.

**Breaking Change:** Sim — ENVs OAuth renomeadas (original). Fase 7: prices do Stripe precisam ser recriados com `trial_period_days=7`, `createSubscription()` perde param `trialDays`, `sendPaymentFailedEmail()` ganha param obrigatório `graceDays`. Deploy precisa duplicar variáveis no Railway durante janela de rollback (≥48h).

---

## Fase 1 — Config & ENV (~3 pts)

### TASK-131: Padronização de ENVs OAuth + flags `*_APP_ENABLE`

**Epic:** 13
**Story:** US-014 (Auth)
**Estimativa:** 2 pts
**Dependências:** Nenhuma

### Subtasks
- [x] Renomear `GOOGLE_CLIENT_ID` → `GOOGLE_APP_ID` em [api/src/modules/auth/passport.config.ts](api/src/modules/auth/passport.config.ts#L20-L78)
- [x] Renomear `GOOGLE_CLIENT_SECRET` → `GOOGLE_APP_SECRET` (mesma trilha)
- [x] Adicionar flags `GOOGLE_APP_ENABLE` e `FACEBOOK_APP_ENABLE` (boolean string `'true'`/`'false'`)
- [x] Guard: só registrar `GoogleStrategy`/`FacebookStrategy` quando `*_APP_ENABLE === 'true'` **E** credenciais não vazias
- [x] Atualizar `.env`, `.env.example` com bloco "OAuth Providers" novo
- [x] Atualizar [.specify/architecture.md:1120-1124](.specify/architecture.md#L1120-L1124) (seção Environment Variables)
- [x] **Migration deploy:** duplicar ENVs antigas no Railway (manter `GOOGLE_CLIENT_ID`/`SECRET` por 48h após release)
- [x] Teste unitário: provider não registrado quando flag `false` (mock `process.env`)
- [x] Teste unitário: provider não registrado quando flag `true` mas credenciais vazias

### Critérios de Done
- [x] Login Google funciona com ENVs novas (com flag `true`)
- [x] `process.env.GOOGLE_APP_ENABLE='false'` → `passport.use(google)` **não** é chamado
- [x] Sem regressão em login email/senha (não toca em LocalStrategy)
- [x] `.env.example` documenta as 4 ENVs novas

---

### TASK-132: Endpoint público `GET /api/v1/auth/config`

**Epic:** 13
**Story:** US-014 (Auth)
**Estimativa:** 1 pt
**Dependências:** TASK-131

### Subtasks
- [x] Novo handler `getAuthConfigController` em [api/src/modules/auth/auth.controller.ts](api/src/modules/auth/auth.controller.ts)
- [x] Lê `process.env.GOOGLE_APP_ENABLE` e `process.env.FACEBOOK_APP_ENABLE` (strings) → boolean
- [x] Response: `{ providers: { google: bool, facebook: bool } }`
- [x] Header `Cache-Control: public, max-age=300` (5min)
- [x] Registrar rota `GET /api/v1/auth/config` em [auth.routes.ts](api/src/modules/auth/auth.routes.ts) **acima** dos endpoints OAuth (público, sem `requireAuth`)
- [x] Rate limit leve: 60 req/min/IP (reaproveitar middleware)
- [x] Teste integração: ambos `true`, só google, ambos `false`

### Critérios de Done
- [x] Endpoint público respondendo 200 sem auth
- [x] Reflete corretamente o estado das flags em runtime (sem rebuild)
- [x] `Cache-Control` setado
- [x] Cobertura: 3 cenários no teste integração

---

## Fase 2 — Frontend Login Condicional (~2 pts)

### TASK-133: Hook `useAuthConfig()` + render condicional no LoginForm

**Epic:** 13
**Story:** US-014 (Auth)
**Estimativa:** 2 pts
**Dependências:** TASK-132

### Subtasks
- [x] Novo hook `useAuthConfig()` em [web/src/modules/auth/hooks/useAuthConfig.ts](web/src/modules/auth/hooks/useAuthConfig.ts) — React Query, `staleTime: 5 * 60 * 1000`
- [x] Service: `GET /api/v1/auth/config` em [web/src/modules/auth/services/auth.service.ts](web/src/modules/auth/services/auth.service.ts)
- [x] [LoginForm.tsx:138-187](web/src/modules/auth/components/LoginForm.tsx#L138-L187): renderização condicional
  - `{config?.providers.google && <GoogleButton />}`
  - `{config?.providers.facebook && <FacebookButton />}`
  - Esconder divisor "ou continue com" quando ambos `false`
- [x] Snapshot tests: 3 estados (ambos habilitados, só google, nenhum)
- [x] Loading state: enquanto `useAuthConfig` carrega, **não** renderiza botões (evita flicker)

### Critérios de Done
- [x] LoginForm reflete flags do backend sem rebuild do frontend
- [x] Divisor "ou continue com" some quando nenhum provider está habilitado
- [x] 3 snapshot tests passando

---

## Fase 3 — Schema DB (~2 pts)

### TASK-134: Migration Prisma — `StoreSegment` enum + campos de endereço

**Epic:** 13
**Story:** US-001B (auto-cadastro)
**Estimativa:** 2 pts
**Dependências:** Nenhuma

### Subtasks
- [x] Adicionar enum `StoreSegment` em [api/prisma/schema.prisma](api/prisma/schema.prisma):
  - `RESTAURANT`, `PIZZERIA`, `BURGER`, `BAKERY`, `ACAI`, `JAPANESE`, `MARKET`, `OTHER`
- [x] Adicionar campos opcionais em `model Store`:
  - `segment StoreSegment?`
  - `cep String?`
  - `street String?`
  - `number String?`
  - `neighborhood String?`
  - `city String?`
  - `state String?` (UF 2 letras, validado em app layer — não enum no DB para facilitar expansão futura)
- [x] Comentar `address` (legado) com `// @deprecated v2.5 — remover em v2.6`
- [x] Rodar `npx prisma migrate dev --name v25-store-segment-and-address-fields`
- [x] Atualizar seed (opcional): preencher `segment='PIZZERIA'` na loja de teste existente
- [x] Validar rollback: campos novos são nullable, lojas existentes não quebram

### Critérios de Done
- [x] Migration aplica em dev sem erro
- [x] `Store.segment` acessível via `prisma.store.create({ data: { segment: 'PIZZERIA' } })`
- [x] `npx prisma migrate reset` + reaplicação funciona
- [x] Lojas existentes têm `segment = NULL` (sem regressão)

---

## Fase 4 — Backend Auto-cadastro (~7 pts)

### TASK-135: `register.schema.ts` — Zod schema com `confirmPassword` + UF

**Epic:** 13
**Story:** US-001B
**Estimativa:** 1 pt
**Dependências:** TASK-134

### Subtasks
- [x] Criar [api/src/modules/auth/register.schema.ts](api/src/modules/auth/register.schema.ts)
- [x] Constante `BR_STATES` com 27 UFs (`const ... as const`)
- [x] Schema `registerStoreSchema` com 12 campos:
  - `storeName` (min 2, max 100)
  - `segment` (enum 8 valores)
  - `email` (email)
  - `password` (min 8)
  - `confirmPassword` (min 8)
  - `whatsapp` (regex `^\d{11}$`)
  - `cep` (regex `^\d{8}$`)
  - `street` (min 2, max 120)
  - `number` (min 1, max 10)
  - `neighborhood` (min 2, max 80)
  - `city` (min 2, max 80)
  - `state` (z.enum BR_STATES)
- [x] `.refine(data => data.password === data.confirmPassword)` com `path: ['confirmPassword']`
- [x] Export `RegisterStoreInput` (z.infer)
- [x] Testes unitários: cada validação + mismatch de senhas + UF inválida + CEP curto + WhatsApp inválido

### Critérios de Done
- [x] Schema valida happy path
- [x] `password !== confirmPassword` retorna erro com `path: ['confirmPassword']`
- [x] UF fora do enum (ex: `'XX'`) retorna erro
- [x] Tipo `RegisterStoreInput` exportado e usado pelo controller

---

### TASK-136: `stripe.service.ts` — `createSubscription(trialDays?)` + `cancelCustomerSafe()`

**Epic:** 13
**Story:** US-001B
**Estimativa:** 1 pt
**Dependências:** Nenhuma (paralelo a TASK-134/135)

### Subtasks
- [x] Adicionar param opcional `trialDays?: number` em `createSubscription()` em [api/src/shared/stripe/stripe.service.ts:60-70](api/src/shared/stripe/stripe.service.ts#L60-L70)
- [x] Quando `trialDays` presente: `payment_behavior: 'allow_incomplete'` + `trial_period_days: trialDays`
- [x] Quando ausente: comportamento atual (`default_incomplete`) — **retrocompatível** com `owner.service.ts:createStore()`
- [x] Novo helper `cancelCustomerSafe(customerId: string)` — wrapper de `stripe.customers.del()` com `try/catch` (idempotente)
- [x] Teste unitário: trial → subscription criada com `trial_period_days`
- [x] Teste unitário: sem trial → comportamento legado preservado
- [x] Teste unitário: `cancelCustomerSafe` engole erro de "customer não existe"

### Critérios de Done
- [x] `createSubscription(customerId, priceId)` (sem trial) inalterado
- [x] `createSubscription(customerId, priceId, 7)` cria subscription `trialing` sem PaymentMethod
- [x] `cancelCustomerSafe('inexistente')` não throwa
- [x] Cobertura: 3 testes unitários

---

### TASK-137: `email.service.ts` — `sendWelcomeSelfRegisterEmail()`

**Epic:** 13
**Story:** US-001B
**Estimativa:** 1 pt
**Dependências:** Nenhuma (paralelo)

### Subtasks
- [x] Novo handler em [api/src/shared/email/email.service.ts](api/src/shared/email/email.service.ts)
- [x] Assinatura: `{ adminEmail, adminName, storeName, storeSlug, trialEndsAt, loginUrl }`
- [x] HTML conforme seção 3.7 do changelog: saudação + trial 7d + URL pública (`{slug}.${PUBLIC_ROOT_DOMAIN}`) + URL painel + email de acesso + próximos passos
- [x] **Sem senha temporária** (cliente definiu a própria) — diferente de `sendWelcomeEmail()` (Owner-driven)
- [x] Subject: `🎉 Bem-vindo ao Super Cardápio — {storeName}`
- [x] Reaproveita `transporter` existente (nodemailer)
- [x] Teste unitário com `nodemailer-mock`: HTML contém `trialEndsStr`, `publicUrl`, `loginUrl`
- [x] Teste unitário: HTML **não** contém a palavra "senha"

### Critérios de Done
- [x] Email envia via transporter mockado nos testes
- [x] HTML contém todos os links importantes
- [x] Não vaza senha em nenhum log/template

---

### TASK-138: `register.service.ts` — `registerStore()` (transacional + rollback Stripe)

**Epic:** 13
**Story:** US-001B
**Estimativa:** 3 pts
**Dependências:** TASK-134, TASK-135, TASK-136, TASK-137

### Subtasks
- [x] Criar [api/src/modules/auth/register.service.ts](api/src/modules/auth/register.service.ts) — **não misturar** com `owner.service.ts`
- [x] Helper `generateUniqueSlug(base)` — `slugify` + sufixo `-2`, `-3`… em colisão
- [x] Validação email único global (`prisma.user.findFirst`)
- [x] Hash de senha bcrypt rounds 12 (padrão existente)
- [x] Stripe Customer + Subscription com trial 7d (usa TASK-136)
- [x] **Try/catch de rollback:** se `createSubscription` falhar → `cancelCustomerSafe(customer.id)` antes de re-throw
- [x] Transação Prisma:
  - `tx.store.create` (com `segment`, `cep`, `street`, `number`, `neighborhood`, `city`, `state`, `phone=whatsapp`, `plan='PROFESSIONAL'`, `status='TRIAL'`, `stripeCustomerId`, `stripeSubscriptionId`, `stripeTrialEndsAt`, `features: PLAN_FEATURES.PROFESSIONAL`)
  - `tx.user.create` (`role='ADMIN'`, `storeId`, `passwordHash`, `isActive: true`)
  - `tx.businessHour.createMany` (Seg-Dom 18h-23h — reaproveitar lógica de [owner.service.ts:126-134](api/src/modules/owner/owner.service.ts#L126-L134))
  - `tx.auditLog.create` (`action: 'store.self-register'`, `ip`)
- [x] **Fire-and-forget** `sendWelcomeSelfRegisterEmail()` (não bloqueia response, `.catch(logger.error)`)
- [x] Emite tokens JWT via `issueTokens()` existente
- [x] Retorna `{ accessToken, refreshToken, store: { id, slug, trialEndsAt } }`
- [x] Constante `TRIAL_DAYS = 7`
- [x] Testes unitários:
  - [ ] Happy path
  - [ ] Slug colisão (`pizzaria-dona-maria` x2 → segundo vira `pizzaria-dona-maria-2`)
  - [ ] Email duplicado → `AppError 422`
  - [ ] Stripe falha → `cancelCustomerSafe` chamado + re-throw
  - [ ] Email falha → não bloqueia (logger.error chamado, response 201 normal)

### Critérios de Done
- [x] Happy path cria Store + User + 7 BusinessHours + AuditLog em transação atômica
- [x] Stripe Subscription criada com `trial_period_days: 7` e status `trialing` (verificável no Dashboard)
- [x] `stripeTrialEndsAt` persistido na Store
- [x] Rollback do Customer em falha
- [x] Tokens JWT emitidos para login automático
- [x] AuditLog inclui `ip` do request
- [x] 5 testes unitários cobrindo cenários

---

### TASK-139: Controller + rota pública `POST /api/v1/auth/register-store` (rate-limited)

**Epic:** 13
**Story:** US-001B
**Estimativa:** 1 pt
**Dependências:** TASK-138

### Subtasks
- [x] Novo controller `registerStoreController` em [auth.controller.ts](api/src/modules/auth/auth.controller.ts)
- [x] Valida body com `registerStoreSchema.parse()` (TASK-135)
- [x] Chama `registerStore(data, req.ip)` (TASK-138)
- [x] Response 201: `{ accessToken, refreshToken, store }`
- [x] **Rate limiter** `express-rate-limit`: `windowMs: 60*60*1000`, `max: 5` (5 req/h/IP)
- [x] Mensagem do limiter: `'Muitas tentativas de cadastro. Tente novamente em 1 hora.'`
- [x] Registrar rota `POST /register-store` em [auth.routes.ts](api/src/modules/auth/auth.routes.ts) — **pública**, com rate limiter
- [x] Sanitizar body do log: nunca logar `password`/`confirmPassword` (adicionar à blacklist do middleware de logging)
- [x] Verificar se `slugify` e `express-rate-limit` estão instalados; se não: `npm i slugify express-rate-limit`
- [x] Teste integração: happy path 201
- [x] Teste integração: 422 (senhas não coincidem)
- [x] Teste integração: 429 na 6ª tentativa do mesmo IP

### Critérios de Done
- [x] Endpoint responde 201 + tokens
- [x] Rate limit 6ª req/h retorna 429
- [x] Logs não vazam senha
- [x] Cobertura: 3 testes integração

---

## Fase 5 — Frontend Cadastro (~6 pts)

### TASK-1310: Constantes — `SEGMENT_OPTIONS`, `BR_STATES`, `BENEFITS`

**Epic:** 13
**Story:** US-001B
**Estimativa:** 0.5 pt
**Dependências:** Nenhuma

### Subtasks
- [x] [web/src/modules/auth/constants/segments.ts](web/src/modules/auth/constants/segments.ts) — 8 segmentos com labels PT (`Restaurante`, `Pizzaria`, `Hamburgueria`, `Padaria / Cafeteria`, `Açaí / Sorveteria`, `Japonês / Sushi`, `Mercado / Conveniência`, `Outro`)
- [x] [web/src/modules/auth/constants/location.ts](web/src/modules/auth/constants/location.ts) — `BR_STATES` com 27 UFs (value + label)
- [x] [web/src/modules/auth/constants/benefits.ts](web/src/modules/auth/constants/benefits.ts) — 12 benefícios da landing em 2 colunas (conforme imagem do cliente)

### Critérios de Done
- [x] 3 arquivos exportam constantes tipadas (`as const`)
- [x] Labels em PT-BR
- [x] Sem dependências circulares

---

### TASK-1311: `RegisterStorePage.tsx` — Landing + Formulário 12 campos

**Epic:** 13
**Story:** US-001B
**Estimativa:** 2 pts
**Dependências:** TASK-1310

### Subtasks
- [x] Criar [web/src/modules/auth/pages/RegisterStorePage.tsx](web/src/modules/auth/pages/RegisterStorePage.tsx)
- [x] Layout 2 colunas desktop / 1 coluna mobile (Tailwind `lg:grid-cols-2`)
- [x] **Coluna esquerda** (fundo escuro `bg-zinc-900`, texto branco):
  - Headline `h1`: **"Teste 100% grátis"**
  - Subheadline: *"Não exigimos cartão para o teste. Acesse todas as funções por 7 dias!"*
  - Grid 2 colunas internas com 12 benefícios (importa de `BENEFITS`) + ícone `CheckCircle2` (lucide-react) verde
- [x] **Coluna direita** (card branco, sombra suave):
  - Título: **"Crie sua loja"**
  - Subtítulo: *"Comece seu teste grátis agora"*
  - Form com `react-hook-form` + `zodResolver(registerStoreSchema)`
  - Campos na ordem exata da seção 4.1 do changelog:
    1. Nome da loja
    2. WhatsApp da loja (máscara)
    3. Segmento (select)
    4. E-mail
    5. Senha (toggle show/hide)
    6. Confirmar senha (toggle show/hide, validação on-blur)
    7. Heading visual "Endereço" + divider
    8. CEP (máscara, auto-dispara ViaCEP)
    9. Rua / Logradouro
    10. Número
    11. Bairro
    12. Cidade
    13. Estado UF (select 27 opções)
  - Nota: *"Ao se cadastrar, você ganha 7 dias grátis com acesso a todas as funções. Não pedimos cartão de crédito."*
  - CTA primário **"Preencha os dados para cadastrar"** (`bg-red-600`, full-width, `h-12`)
  - **Sem botões sociais**
  - Link rodapé: *"Já tem conta?"* → **"Entrar"** (Link para `/login`)
- [x] Snapshot tests (estado inicial + estado com erros)

### Critérios de Done
- [x] Página renderiza em desktop e mobile
- [x] 12 campos visíveis na ordem correta
- [x] CTA desabilitado enquanto submitting
- [x] **Não importa** `GoogleButton`/`FacebookButton`
- [x] Snapshot tests passando

---

### TASK-1312: `useViaCep()` + máscaras CEP/WhatsApp + auto-preenchimento

**Epic:** 13
**Story:** US-001B
**Estimativa:** 1.5 pt
**Dependências:** TASK-1311

### Subtasks
- [x] Criar [web/src/modules/auth/hooks/useViaCep.ts](web/src/modules/auth/hooks/useViaCep.ts) com `fetchCep(cep)` retornando `{ street, neighborhood, city, state }`
- [x] Tratar `data.erro === true` → throw `'CEP não encontrado'`
- [x] Máscara CEP `XXXXX-XXX` (helper em [web/src/shared/utils/masks.ts](web/src/shared/utils/masks.ts) ou novo)
- [x] Máscara WhatsApp `(XX) XXXXX-XXXX`
- [x] No `RegisterStorePage`: `useEffect` observando `watch('cep')` — quando 8 dígitos limpos, dispara `fetchCep` e `setValue` em `street`, `neighborhood`, `city`, `state`
- [x] **Fallback silencioso:** ViaCEP offline ou CEP inexistente → campos ficam editáveis manualmente (sem toast de erro bloqueante)
- [x] Teste unitário do hook (mock `fetch`)
- [x] Teste manual: digitar `01310-100` → "São Paulo / SP" preenchidos

### Critérios de Done
- [x] CEP válido auto-preenche 4 campos
- [x] CEP inválido não bloqueia o formulário
- [x] Máscaras aplicadas durante digitação
- [x] Hook tem teste unitário

### Hotfix v2.5.4 (2026-04-10)
- [x] **Bug:** `lookup` criado inline em cada render (sem `useCallback`) → `useEffect` com `lookupCep` nas deps entrava em loop infinito de requests ao ViaCEP ao digitar 8 dígitos.
- [x] **Fix 1:** `lookup` memoizado com `useCallback(async ..., [])` em `useViaCep.ts`
- [x] **Fix 2:** `lastLookedUpCepRef` em `RegisterStorePage.tsx` previne re-fetch do mesmo CEP (defesa em profundidade)

---

### TASK-1313: Mutation `useRegisterStore()` + tratamento de erros

**Epic:** 13
**Story:** US-001B
**Estimativa:** 1 pt
**Dependências:** TASK-1311, TASK-139

### Subtasks
- [x] Service `registerStore(data)` em [auth.service.ts](web/src/modules/auth/services/auth.service.ts) — `POST /api/v1/auth/register-store`
- [x] Hook `useRegisterStore()` em [web/src/modules/auth/hooks/useRegisterStore.ts](web/src/modules/auth/hooks/useRegisterStore.ts) — React Query mutation
- [x] **onSuccess:** `useAuthStore().setTokens()` + toast "Bem-vindo!" + `navigate('/dashboard')`
- [x] **onError 422 (email duplicado):** `setError('email', { message: 'Email já cadastrado' })`
- [x] **onError 422 (senhas não coincidem):** `setError('confirmPassword', { message: 'As senhas não coincidem' })`
- [x] **onError 429 (rate limit):** toast `'Muitas tentativas, tente novamente em 1 hora'`
- [x] **onError 5xx:** toast genérico
- [x] Wire-up no submit do `RegisterStorePage`

### Critérios de Done
- [x] Submit chama mutation, salva tokens, redireciona
- [x] Erros 422 destacam campos específicos
- [x] Erro 429 exibe toast adequado
- [x] Loading state desabilita CTA

---

### TASK-1314: Rota `/cadastro` + link "Criar minha loja" no LoginPage

**Epic:** 13
**Story:** US-001B
**Estimativa:** 1 pt
**Dependências:** TASK-1311

### Subtasks
- [x] Adicionar `<Route path="/cadastro" element={<RegisterStorePage />} />` em [web/src/App.tsx](web/src/App.tsx) — **público**, fora de `RequireAuth`
- [x] Adicionar link no [LoginPage.tsx](web/src/modules/auth/pages/LoginPage.tsx) abaixo do `LoginForm`:
  - *"Ainda não tem conta?"* → **"Criar minha loja grátis"** (Link para `/cadastro`)
- [x] Validar redirect: `/cadastro` acessível sem auth
- [x] Validar que usuário logado em `/cadastro` é redirecionado para `/dashboard` (regra de UX, não bloqueante)

### Critérios de Done
- [x] Rota acessível em `http://localhost:5173/cadastro`
- [x] Link visível no LoginPage
- [x] Sem regressão em rotas autenticadas

---

## Fase 6 — QA + Docs (~3 pts)

### TASK-1315: E2E Playwright — cadastro completo + flags OAuth

**Epic:** 13
**Story:** US-001B, US-014
**Estimativa:** 2 pts
**Dependências:** TASK-139, TASK-1313, TASK-133

### Subtasks
- [x] Criar `e2e/register-store.spec.ts`
- [x] **Cenário 1 — Happy path:**
  - Acessa `/cadastro`
  - Preenche 12 campos (CEP `88010000` → ViaCEP autocompleta `street`, `neighborhood`, `city`, `state='SC'`)
  - Submit → loja criada
  - Stripe trial 7d criado (mock) + welcome email enviado (mock transporter)
  - Redireciona para `/dashboard` (logado)
- [x] **Cenário 2 — Senhas não coincidem:**
  - Preenche `password='senha1234'`, `confirmPassword='senha9999'`
  - Submit → erro inline em `confirmPassword`
- [x] **Cenário 3 — Email duplicado:**
  - Pré-cria loja com email
  - Tenta cadastrar com mesmo email → 422 + erro inline
- [x] **Cenário 4 — Rate limit:**
  - 6 cadastros consecutivos do mesmo IP → 6º bloqueado com toast
- [x] **Cenário 5 — OAuth flag desligada:**
  - Mock `/api/v1/auth/config` → `{ google: false, facebook: false }`
  - Acessa `/login` → botões sociais **não** aparecem, divisor "ou continue com" some
- [x] **Cenário 6 — Só Google habilitado:**
  - Mock → `{ google: true, facebook: false }`
  - `/login` → botão Google visível, Facebook ausente

### Critérios de Done
- [x] 6 cenários passando no Playwright
- [x] Mocks de Stripe e email funcionais
- [x] Sem flakes (rodar 3x consecutivas)

---

### TASK-1316: Atualização de Spec + Architecture + Changelog

**Epic:** 13
**Story:** Docs
**Estimativa:** 1 pt
**Dependências:** Todas as tasks acima (executar por último)

### Subtasks
- [x] [`spec.md`](.specify/spec.md):
  - Bump versão `2.4.0` → `2.5.0` (linha 7)
  - Atualizar "Última atualização" para `2026-04-10` (linha 8)
  - Renomear "Jornada 1" → "Jornada 1A: Owner cria loja para cliente" (linha 151)
  - Adicionar "Jornada 1B: Auto-cadastro via landing `/cadastro`" antes da 1A
  - Renomear `US-001` → `US-001A` (linha 400-427)
  - Criar `US-001B — Auto-cadastro de Loja` com critérios (campos, rate limit, trial 7d, email welcome, login auto)
  - Atualizar seção Segurança/Autenticação (linha 1132-1137): mencionar `*_APP_ENABLE` flags
  - Adicionar entrada `v2.5.0` no Changelog (linha 1548-1564)
- [x] [`architecture.md`](.specify/architecture.md):
  - Bump versão `2.5.0`
  - Linhas 1120-1124: renomear `GOOGLE_CLIENT_ID/SECRET` → `GOOGLE_APP_ID/SECRET` + adicionar `GOOGLE_APP_ENABLE` e `FACEBOOK_APP_ENABLE`
  - Linhas 642-650: adicionar `GET /api/v1/auth/config` e `POST /api/v1/auth/register-store` no Authentication Flow
  - Adicionar bloco "Public — `/api/v1/auth`" em Endpoints por Módulo (~linha 660+)
  - Data Model — Store (~linha 440): adicionar `segment`, `cep`, `street`, `number`, `neighborhood`, `city`, `state` + enum `StoreSegment`
  - Adicionar entrada changelog
- [x] `.env.example`: documentar 4 ENVs OAuth novas com comentário `# v2.5+`

### Critérios de Done
- [x] Spec e architecture com versão `2.5.0`
- [x] US-001A e US-001B documentados
- [x] ENVs novas no `.env.example`
- [x] Changelog atualizado em ambos os docs

---

## Fase 7 — Trial Hardening + Observability (Patch v2.5.2, 2026-04-10)

> Tasks criadas após primeira rodada do Epic 13 ser concluída. Cobrem as lacunas identificadas em
> análise pós-implementação (ver `.specify/changelog/v2.5-migration.md` — Patch v2.5.2).

### TASK-1317: Migrar trial 7d do código para o Price do Stripe

**Epic:** 13
**Story:** US-001B
**Estimativa:** 1 pt
**Dependências:** TASK-136 (createSubscription)

### Subtasks
- [x] Arquivar prices antigos via Stripe CLI (`stripe prices update <id> --active=false`)
- [x] Criar prices novos com `-d "recurring[trial_period_days]=7"` (Profissional R$ 99 / Premium R$ 149, BRL)
- [x] Simplificar [api/src/shared/stripe/stripe.service.ts](api/src/shared/stripe/stripe.service.ts) — `createSubscription()` perde param `trialDays`, sempre usa `payment_behavior: 'allow_incomplete'`
- [x] Adicionar `trial_end: number | null` no tipo de retorno da subscription
- [x] Ajustar [api/src/modules/auth/register.service.ts](api/src/modules/auth/register.service.ts) — remover `TRIAL_DAYS`, ler `stripeSubscription.trial_end`, fail-fast se vier null
- [x] Ajustar [api/src/modules/owner/owner.service.ts](api/src/modules/owner/owner.service.ts) — também ler e persistir `stripeTrialEndsAt`
- [x] Atualizar `STRIPE_PROFESSIONAL_PRICE_ID` e `STRIPE_PREMIUM_PRICE_ID` em `api/.env`
- [x] Atualizar tests: `stripe.service.test.ts`, `register.service.test.ts`, `owner.service.test.ts`, `owner.integration.test.ts`

### Critérios de Done
- [x] `createSubscription(customerId, priceId)` é função de 2 args
- [x] Ambos os fluxos (Owner e self-register) persistem `stripeTrialEndsAt` automaticamente
- [x] Testes afetados passando

---

### TASK-1318: `STRIPE_GRACE_PERIOD_DAYS` env var + template `{{graceDays}}`

**Epic:** 13
**Story:** US-001B
**Estimativa:** 1 pt
**Dependências:** Nenhuma

### Subtasks
- [x] Adicionar `STRIPE_GRACE_PERIOD_DAYS=1` em `api/.env` e `api/.env.example`
- [x] Refatorar [api/src/modules/webhooks/stripe.webhook.ts](api/src/modules/webhooks/stripe.webhook.ts) — ler `Number(process.env.STRIPE_GRACE_PERIOD_DAYS ?? 1)` no topo do módulo
- [x] `sendPaymentFailedEmail()` aceita `graceDays: number` como param obrigatório
- [x] Template `payment-failed.html` usa `{{graceDays}}` e `{{graceDaysPlural}}` (singular/plural)
- [x] AuditLog `store.payment.failed` persiste `graceDays` no campo `data`
- [x] Atualizar testes: `email.service.test.ts` (pluralização), `stripe.webhook.test.ts` (janela dinâmica)

### Critérios de Done
- [x] Mudar env var de 1 → 5 reflete no email e no cálculo de `suspendAt` sem redeploy
- [x] Template singulariza "1 dia" e pluraliza "5 dias"

---

### TASK-1319: Webhook handler `customer.subscription.trial_will_end`

**Epic:** 13
**Story:** US-001B
**Estimativa:** 1 pt
**Dependências:** TASK-1318

### Subtasks
- [x] Novo case `customer.subscription.trial_will_end` em [stripe.webhook.ts](api/src/modules/webhooks/stripe.webhook.ts)
- [x] Criar `sendTrialEndingEmail(params)` em [email.service.ts](api/src/shared/email/email.service.ts) com formatação `pt-BR` do `trialEndsAt`
- [x] Criar template [trial-ending.html](api/src/shared/email/templates/trial-ending.html) com botão "Cadastrar forma de pagamento"
- [x] AuditLog action `store.trial.ending` com `trialEndsAt` no `data`
- [x] Logs via `stripeLogger.info`/`.error`

### Critérios de Done
- [x] Webhook `trial_will_end` dispara email com data formatada
- [x] Falha de email não quebra o webhook (catch logado)

---

### TASK-1320: Cron Bull `trial-suspension.job`

**Epic:** 13
**Story:** US-001B
**Estimativa:** 2 pts
**Dependências:** TASK-1318

### Subtasks
- [x] Novo arquivo [api/src/jobs/trial-suspension.job.ts](api/src/jobs/trial-suspension.job.ts) com queue Bull e `getTrialSuspensionQueue()`
- [x] Processor: `findMany` de `Store` com `status='TRIAL' AND stripeTrialEndsAt < NOW()` → update `status='SUSPENDED'` + AuditLog em transação
- [x] `registerTrialSuspensionJob()` — remove jobs existentes antes de adicionar (evita duplicação em redeploy)
- [x] Cron default `0 3 * * *` (configurável via `TRIAL_SUSPENSION_CRON`)
- [x] Flag `DISABLE_CRON_JOBS=true` para skipar em CI/testes
- [x] Chamar `registerTrialSuspensionJob()` em [api/src/index.ts](api/src/index.ts) no bootstrap
- [x] AuditLog action `store.trial.suspended` com `reason: 'trial-suspension-cron'` e `trialEndedAt`

### Critérios de Done
- [x] Cron registra com sucesso no bootstrap (visível no log)
- [x] Loja com `stripeTrialEndsAt < NOW()` é suspensa na próxima execução
- [x] Loja com `status != TRIAL` não é tocada

---

### TASK-1321: Endpoint `POST /api/v1/billing/portal-session` + UI "Assinatura"

**Epic:** 13
**Story:** US-001B
**Estimativa:** 2 pts
**Dependências:** Nenhuma

### Subtasks
- [x] Estender `StripeClient` interface em [stripe.service.ts](api/src/shared/stripe/stripe.service.ts) com `billingPortal.sessions.create()`
- [x] Nova função `createBillingPortalSession(customerId, returnUrl)`
- [x] Novo módulo `api/src/modules/billing/` — service + controller + routes
- [x] Endpoint `POST /api/v1/billing/portal-session` protegido por `authMiddleware + extractStoreId + requireRole('ADMIN') + requireStore`
- [x] Return URL: `${WEB_URL}/admin/configuracoes`
- [x] Registrar `billingRouter` em [api/src/router.ts](api/src/router.ts)
- [x] Estender `getStore()` em [admin/store.service.ts](api/src/modules/admin/store.service.ts) com `plan`, `status`, `stripeTrialEndsAt`
- [x] Frontend: `web/src/modules/admin/services/billing.service.ts` — `createBillingPortalSession()`
- [x] Frontend: `web/src/modules/admin/hooks/useBilling.ts` — `useOpenBillingPortal()` (redirect `window.location.href`)
- [x] Frontend: Nova tab **"Assinatura"** em [SettingsPage.tsx](web/src/modules/admin/pages/SettingsPage.tsx) com card de status + botão
- [x] Estender `StoreData` interface do frontend com `status` e `stripeTrialEndsAt`

### Critérios de Done
- [x] Admin logado abre tab "Assinatura" e vê plano/status
- [x] Botão redireciona pro Stripe Customer Portal
- [x] Após cadastrar cartão no portal, webhook `customer.subscription.updated` atualiza status
- [x] **Manual:** habilitar Customer Portal em Stripe Dashboard → Settings → Billing → Customer portal

---

### TASK-1322: Logging estruturado com Pino

**Epic:** 13
**Story:** Observability
**Estimativa:** 1 pt
**Dependências:** Nenhuma (precondição pros cron e webhook)

### Subtasks
- [x] Instalar deps: `pino`, `pino-pretty`, `pino-roll`
- [x] Criar `api/src/shared/logger/logger.ts` com `logger` e `stripeLogger`
- [x] `stripeLogger` escreve em `api/logs/stripe.log` com rotação (45d, 3 arquivos)
- [x] Silencioso em `NODE_ENV=test`
- [x] Padrão: `logger.info({ contexto }, 'mensagem')` (ref: `/Users/mfabiodias/Sites/Projects/workana/igor/server/src/config/logger.ts`)
- [x] Substituir `console.*` nas áreas novas: `stripe.webhook.ts`, `trial-suspension.job.ts`, `billing.service.ts`, `index.ts`
- [x] Adicionar `api/logs/` ao `.gitignore`
- [x] Env vars opcionais: `LOG_LEVEL`, `LOG_LEVEL_STRIPE`

### Critérios de Done
- [x] `api/logs/stripe.log` é criado ao rodar o servidor em dev
- [x] Logs estruturados com contexto (`storeId`, `customerId`, `eventType`)
- [x] Testes não poluem output nem criam arquivos

### Fora de escopo
- ❌ Migrar os outros 52 `console.*` do projeto (refactor separado, não tem relação com Stripe/trial)

---

### TASK-1323: Cards de seleção de plano no cadastro

**Epic:** 13
**Story:** US-001B
**Estimativa:** 1 pt
**Dependências:** TASK-1317

### Subtasks
- [x] Adicionar `plan: 'PROFESSIONAL' | 'PREMIUM'` ao schema Zod [register.schema.ts](api/src/modules/auth/register.schema.ts) (com `.default('PROFESSIONAL')`)
- [x] `registerStore()` service usa `input.plan` ao invés de hardcoded `PROFESSIONAL` (PLAN_FEATURES agora é Record<plan, features>)
- [x] Frontend: 2 cards lado a lado no topo do form [RegisterStorePage.tsx](web/src/modules/auth/pages/RegisterStorePage.tsx)
  - Profissional (R$ 99) — WhatsApp
  - Premium (R$ 149) — WhatsApp + IA (badge "Recomendado")
- [x] Estado controlado via `react-hook-form` (`watch('plan')` + `setValue('plan')`)
- [x] Hidden input `<input {...register('plan')}>` pra submissão
- [x] Texto "Ambos os planos incluem 7 dias grátis sem cartão"
- [x] Estender `RegisterStorePayload` interface do frontend com `plan`
- [x] `registerStoreFormSchema` do frontend adiciona enum `plan`

### Critérios de Done
- [x] Usuário pode trocar entre cards visualmente (highlight do selecionado)
- [x] Plano escolhido é enviado ao backend e persistido em `Store.plan`
- [x] PLAN_FEATURES correto é aplicado baseado no plano

---

## Checklist Pré-Release (Sprint 19)

### Backend — OAuth
- [x] ENVs renomeadas em `.env`, `.env.example` e Railway (prod + staging)
- [x] `GOOGLE_APP_ENABLE` e `FACEBOOK_APP_ENABLE` setados em todos os ambientes
- [x] Strategies não registradas quando flag `false` (validar manual: setar `false`, restart, `/auth/google` → 404/500)
- [x] `GET /api/v1/auth/config` retorna `{ google, facebook }` corretos
- [x] Cache-Control de 5min ativo

### Backend — Auto-cadastro
- [x] `POST /api/v1/auth/register-store` cria Store + User + BusinessHours + AuditLog em transação
- [x] Stripe Customer + Subscription criados **com `trial_period_days: 7`**
- [x] `stripeTrialEndsAt` persistido na Store
- [x] Subscription fica ativa **sem exigir cartão** (Stripe Dashboard mostra status `trialing`)
- [x] Slug único gerado automaticamente (testar colisão: "Pizzaria Dona Maria" x2)
- [x] Validação `password === confirmPassword` retorna 422 com `path: ['confirmPassword']`
- [x] Campo `state` (UF) validado contra lista fixa
- [x] Rollback do Stripe Customer se transação Prisma falhar
- [x] Rate limit 5/h/IP ativo (6ª tentativa bloqueada com 429)
- [x] Tokens JWT emitidos corretamente após cadastro
- [x] AuditLog `store.self-register` registrado com `ip`
- [x] `password`/`confirmPassword` **não aparecem** em logs de request/audit

### Backend — Notificações
- [x] `sendWelcomeSelfRegisterEmail()` dispara para o email cadastrado
- [x] Email contém: nome da loja, `trialEndsAt`, URL pública, URL painel, links de suporte/treinamento
- [x] Email **não contém** senha (cliente definiu a própria)
- [x] Falha de email **não bloqueia** o cadastro (fire-and-forget)
- [x] Logs de erro de email incluem `storeId` para debug
- [x] **Nenhuma mensagem WhatsApp de boas-vindas** é enviada (fora do escopo v2.5)

### Frontend
- [x] `LoginForm` esconde botões sociais quando flags `false`
- [x] Divisor "ou continue com" some quando ambos desabilitados
- [x] Página `/cadastro` renderiza landing (12 benefícios em 2 colunas) + formulário
- [x] Formulário tem todos os 12 campos na ordem especificada
- [x] Campo "Confirmar senha" valida contra "Senha" on-blur
- [x] Toggle show/hide em ambos os campos de senha
- [x] Select de Segmento com 8 opções traduzidas
- [x] Select de Estado com 27 UFs
- [x] ViaCEP auto-preenche `street`, `neighborhood`, `city`, **`state`**
- [x] Máscaras CEP `XXXXX-XXX` + WhatsApp `(XX) XXXXX-XXXX` funcionam
- [x] CEP inexistente: campos ficam editáveis (sem erro bloqueante)
- [x] CTA "Preencha os dados para cadastrar" desabilitado enquanto submitting
- [x] Após cadastro, redireciona para `/dashboard` (usuário logado)
- [x] Erro 422 (email duplicado) destaca o campo email
- [x] Erro 422 (senhas não coincidem) destaca `confirmPassword`
- [x] Erro 429 (rate limit) exibe toast adequado
- [x] Link "Ainda não tem conta? Criar minha loja grátis" visível no LoginPage
- [x] Layout responsivo: 2 colunas desktop, empilhado mobile

### DB
- [x] Migration aplicada em staging sem erro
- [x] Campos novos (`segment`, `cep`, `street`, `number`, `neighborhood`, `city`, `state`) são `NULL` para lojas existentes (não quebra queries antigas)
- [x] Enum `StoreSegment` acessível via Prisma Client

### Docs
- [x] `spec.md` v2.5.0 com US-001A/US-001B atualizados
- [x] `architecture.md` v2.5.0 com ENVs OAuth renomeadas + novos endpoints
- [x] Changelog entries adicionados em ambos
- [x] `.env.example` atualizado com todas as ENVs novas

---

## Resumo de Arquivos a Criar/Modificar

### Backend
| Arquivo | Tipo | O que muda |
|---|---|---|
| `api/src/modules/auth/passport.config.ts` | Modify | Renomear ENVs + guard `*_APP_ENABLE` |
| `api/src/modules/auth/auth.controller.ts` | Modify | + `getAuthConfigController` + `registerStoreController` |
| `api/src/modules/auth/auth.routes.ts` | Modify | + `GET /config` + `POST /register-store` (rate-limited) |
| `api/src/modules/auth/register.schema.ts` | New | Zod schema 12 campos + refine |
| `api/src/modules/auth/register.service.ts` | New | `registerStore()` transacional + rollback Stripe |
| `api/src/shared/stripe/stripe.service.ts` | Modify | `createSubscription(trialDays?)` + `cancelCustomerSafe()` |
| `api/src/shared/email/email.service.ts` | Modify | + `sendWelcomeSelfRegisterEmail()` |
| `api/prisma/schema.prisma` | Modify | + enum `StoreSegment` + 7 campos em `Store` |
| `api/prisma/migrations/.../migration.sql` | New | `v25-store-segment-and-address-fields` |
| `.env.example` | Modify | Renomear OAuth + adicionar `*_APP_ENABLE` |

### Frontend
| Arquivo | Tipo | O que muda |
|---|---|---|
| `web/src/modules/auth/pages/RegisterStorePage.tsx` | New | Landing + formulário 12 campos |
| `web/src/modules/auth/pages/LoginPage.tsx` | Modify | + link "Criar minha loja grátis" |
| `web/src/modules/auth/components/LoginForm.tsx` | Modify | Botões sociais condicionais |
| `web/src/modules/auth/hooks/useAuthConfig.ts` | New | React Query hook |
| `web/src/modules/auth/hooks/useViaCep.ts` | New | Fetch + autocomplete |
| `web/src/modules/auth/hooks/useRegisterStore.ts` | New | Mutation |
| `web/src/modules/auth/services/auth.service.ts` | Modify | + `getAuthConfig()` + `registerStore()` |
| `web/src/modules/auth/constants/segments.ts` | New | 8 segmentos |
| `web/src/modules/auth/constants/location.ts` | New | 27 UFs |
| `web/src/modules/auth/constants/benefits.ts` | New | 12 benefícios |
| `web/src/shared/utils/masks.ts` | Modify | + CEP + WhatsApp |
| `web/src/App.tsx` | Modify | + rota `/cadastro` |

### Testes
| Arquivo | Tipo | Cobertura |
|---|---|---|
| `api/src/modules/auth/__tests__/register.schema.test.ts` | New | Validações Zod (TASK-135) |
| `api/src/modules/auth/__tests__/register.service.test.ts` | New | 5 cenários (TASK-138) |
| `api/src/modules/auth/__tests__/auth.controller.test.ts` | Modify | + 3 testes integração (TASK-132, TASK-139) |
| `api/src/shared/stripe/__tests__/stripe.service.test.ts` | Modify | + 3 testes (TASK-136) |
| `api/src/shared/email/__tests__/email.service.test.ts` | Modify | + 2 testes (TASK-137) |
| `web/src/modules/auth/components/__tests__/LoginForm.test.tsx` | Modify | + 3 snapshots (TASK-133) |
| `web/src/modules/auth/hooks/__tests__/useViaCep.test.ts` | New | Hook (TASK-1312) |
| `web/src/modules/auth/pages/__tests__/RegisterStorePage.test.tsx` | New | Snapshots (TASK-1311) |
| `e2e/register-store.spec.ts` | New | 6 cenários Playwright (TASK-1315) |

---

## Estimativa Total

| Fase | Tasks | Pts |
|---|---|---|
| 1 — Config & ENV | TASK-131, 132 | 3 pts |
| 2 — Frontend Login condicional | TASK-133 | 2 pts |
| 3 — Schema DB | TASK-134 | 2 pts |
| 4 — Backend Auto-cadastro | TASK-135, 136, 137, 138, 139 | 7 pts |
| 5 — Frontend Cadastro | TASK-1310, 1311, 1312, 1313, 1314 | 6 pts |
| 6 — QA + Docs | TASK-1315, 1316 | 3 pts |
| **Total** | **16 tasks** | **~23 pts** |

**Sprint alvo:** Sprint 19 (próximo após Sprint 18 / Epic 12)

---

## Ordem de Execução Recomendada

```
TASK-131 (ENVs OAuth + flags)
  ↓
TASK-132 (endpoint /auth/config)        TASK-134 (migration DB)
  ↓                                       ↓
TASK-133 (LoginForm condicional)        TASK-135 (Zod schema)
                                          ↓
                                        TASK-136 (Stripe trial)  TASK-137 (email welcome)
                                          ↓                        ↓
                                        TASK-138 (registerStore service) ←─┘
                                          ↓
                                        TASK-139 (controller + rota + rate limit)
                                          ↓
TASK-1310 (constants)                     │
  ↓                                       │
TASK-1311 (RegisterStorePage)             │
  ↓                                       │
TASK-1312 (ViaCEP) ──────────────────────┐│
  ↓                                      ││
TASK-1313 (mutation) ←───────────────────┴┘
  ↓
TASK-1314 (rota + link no LoginPage)
  ↓
TASK-1315 (E2E Playwright)
  ↓
TASK-1316 (Spec + Architecture + Changelog)
```

**Paralelizáveis:**
- Fase 3 (TASK-134) com Fase 4 inicial (TASK-135, 136, 137)
- TASK-1310 com qualquer task de backend
- TASK-1316 só no final, depois de tudo validado em E2E

---

## Fase 8 — Owner Tool: Encerrar trial agora (~2 pts)

### TASK-1317: Botão "Encerrar trial agora" no Owner StoreDetailPage + email trial-suspended

**Epic:** 13
**Story:** US-001B (Auto-cadastro / Trial)
**Estimativa:** 2 pts
**Dependências:** TASK-138 (cron `trial-suspension.job`), TASK-139 (Customer Portal)

### Motivação
Validar o ciclo completo trial → `invoice.payment_failed` → `SUSPENDED` → email em ~10s sem esperar 7 dias reais. Anteriormente o cliente teria que mockar timestamps no banco ou usar Stripe Test Clocks (mais invasivo, exige criar customer atrelado ao test_clock). Em v2.5.8 a feature foi promovida a ação operacional permanente do Owner (ver atualização abaixo).

### Subtasks
- [x] Adicionar `endSubscriptionTrialNow(subId)` em [api/src/shared/stripe/stripe.service.ts](api/src/shared/stripe/stripe.service.ts) — chama `subscriptions.update(sub, { trial_end: 'now' })`
- [x] Criar template `api/src/shared/email/templates/trial-suspended.html` (variáveis: `adminName`, `storeName`, `billingUrl`, `supportEmail`)
- [x] Adicionar `sendTrialSuspendedEmail()` em [api/src/shared/email/email.service.ts](api/src/shared/email/email.service.ts)
- [x] Atualizar [api/src/jobs/trial-suspension.job.ts](api/src/jobs/trial-suspension.job.ts) — incluir `users` (admin) no `findMany` e disparar `sendTrialSuspendedEmail()` após mover loja pra `SUSPENDED` (beneficia produção também)
- [x] Adicionar `endTrialNow(storeId, ownerId, ip)` em [api/src/modules/owner/owner.service.ts](api/src/modules/owner/owner.service.ts) — chama `endSubscriptionTrialNow` + `getTrialSuspensionQueue().add({})` + `auditLog.create({ action: 'store.trial.ended.dev' })`
- [x] Adicionar `endTrialNowController` em [api/src/modules/owner/owner.controller.ts](api/src/modules/owner/owner.controller.ts)
- [x] Registrar rota em [api/src/modules/owner/owner.routes.ts](api/src/modules/owner/owner.routes.ts): `ownerRouter.post('/stores/:id/dev/end-trial', endTrialNowController)`. Autorização herda do `authMiddleware + requireRole('OWNER')` aplicado ao `ownerRouter` no topo.
- [x] Frontend: função `endTrialNow(id)` em [web/src/modules/owner/services/owner.service.ts](web/src/modules/owner/services/owner.service.ts)
- [x] Frontend: hook `useEndTrialNow(id)` em [web/src/modules/owner/hooks/useOwnerStores.ts](web/src/modules/owner/hooks/useOwnerStores.ts) — invalida cache da loja após 1.5s pra dar tempo do sweep processar
- [x] Frontend: card amarelo "Encerrar trial agora" em [web/src/modules/owner/pages/StoreDetailPage.tsx](web/src/modules/owner/pages/StoreDetailPage.tsx), visível sempre que `store.status === 'TRIAL'`
- [x] Testes: `endTrialNow` em [api/src/modules/owner/__tests__/owner.service.test.ts](api/src/modules/owner/__tests__/owner.service.test.ts) — cobre happy path, 404, 422 (status != TRIAL), Stripe API failure best-effort
- [x] Testes: `sendTrialSuspendedEmail` em [api/src/shared/email/__tests__/email.service.test.ts](api/src/shared/email/__tests__/email.service.test.ts) — cobre body, subject, support email default/custom, layout
- [x] Atualizar `.specify/architecture.md` (seção Stripe + Email transacional + ENVs)
- [x] Atualizar `.specify/changelog/v2.5-migration.md` (seção 7B + Novas envs + Novos arquivos)
- [x] Atualizar `api/src/shared/email/templates/README.md` (tabela de templates)

### Critérios de Done
- [x] Combo `STRIPE_GRACE_PERIOD_DAYS=0` + botão "Encerrar trial agora" valida trial → SUSPENDED + email em ~10s sem mocks
- [x] Em produção: card aparece sempre que `store.status === 'TRIAL'`, ação protegida por `requireRole('OWNER')`
- [x] Cron `trial-suspension.job` envia `sendTrialSuspendedEmail` mesmo em produção (não só dev) — beneficia clientes reais
- [x] Audit log `store.trial.ended.dev` rastreia cada uso da ação

### Atualização v2.5.8 — promoção a ação operacional permanente

Originalmente (v2.5.3) a feature era um **dev tool condicional**, gated por `isDevToolsEnabled()` (helper em `api/src/shared/config/dev-tools.ts`) + env `ENABLE_TRIAL_DEV_TOOLS`. Em produção a rota nem era registrada e o botão não renderizava. Em v2.5.8 esse gating foi removido porque a feature é genuinamente útil pra suporte operacional em prod (agir sobre loja específica sem esperar o ciclo natural de 7 dias).

Mudanças:
- **Deletado:** `api/src/shared/config/dev-tools.ts` (helper inteiro)
- **Removido:** import `isDevToolsEnabled` de `owner.routes.ts`, `owner.service.ts`
- **Removido:** guard `if (!isDevToolsEnabled()) throw 403` dentro de `endTrialNow()`
- **Removido:** campo `devToolsEnabled` no retorno de `getStore()` e no tipo `StoreDetail` do frontend
- **Removido:** env `ENABLE_TRIAL_DEV_TOOLS` de `api/.env` e `api/.env.example`
- **Removido:** teste "joga 403 quando dev tools desabilitadas" em `owner.service.test.ts`
- **Atualizado:** badge da UI de "Dev Tool" pra "Owner" (ainda amarelo pra sinalizar ação sensível), condição `store.devToolsEnabled` removida, ficando só `store.status === 'TRIAL'`
- **Autorização:** continua herdando `authMiddleware + requireRole('OWNER')` do `ownerRouter` — só Owners autenticados conseguem chamar. Cada uso é registrado no `AuditLog` (`action: 'store.trial.ended.dev'`).

---

## Riscos & Mitigação

| Risco | Mitigação |
|---|---|
| Deploy das ENVs renomeadas fica meio-caminho → login Google quebra | Duplicar ENVs no Railway (antigo + novo) durante janela de 48h |
| Auto-cadastro vira vetor de spam / fake stores | Rate limit 5/h/IP + futuro: captcha/email verification (v2.6) |
| Stripe Customer criado sem rollback em caso de falha DB | `try/catch` ao redor de `createSubscription` chama `cancelCustomerSafe(customer.id)` |
| Trial 7d sem cartão → cliente fantasma consome recursos | Webhook `invoice.payment_failed` existente faz downgrade após trial |
| `payment_behavior: 'allow_incomplete'` pode deixar subscription em estado estranho | Monitorar Stripe Dashboard na primeira semana pós-release |
| ViaCEP fora do ar → formulário não funciona | Fallback: campos editáveis manualmente; `state` select como plano B |
| Email verification ausente → registros fake | Aceitável v2.5; adicionar em v2.6 |
| Email welcome cai no spam | `SMTP_FROM` com SPF/DKIM + domínio verificado; monitorar bounce rate |
| `confirmPassword` em logs → vazamento | Sanitizar body request em middleware de logging |
| Trial 7d expirando sem aviso → churn | v2.6: job que envia email "faltam 2 dias" no dia 5 do trial |

---

## Dependências Externas

### Pacotes npm
- [x] `slugify` — verificar instalação; se ausente: `cd api && npm i slugify`
- [x] `express-rate-limit` — verificar; se ausente: `cd api && npm i express-rate-limit`

### Provider de Email
- [x] SMTP configurado em prod (não apenas MailHog dev)
- [x] `SMTP_FROM` com domínio verificado (SPF/DKIM)

### Variáveis de ambiente novas (Railway prod + staging)
- [x] `GOOGLE_APP_ID` (renomear de `GOOGLE_CLIENT_ID`)
- [x] `GOOGLE_APP_SECRET` (renomear de `GOOGLE_CLIENT_SECRET`)
- [x] `GOOGLE_APP_ENABLE=true`
- [x] `FACEBOOK_APP_ID` (já existe)
- [x] `FACEBOOK_APP_SECRET` (já existe)
- [x] `FACEBOOK_APP_ENABLE=false` (até aprovação Meta)

> **Nota:** nenhuma ENV nova é necessária para o fluxo de auto-cadastro em si — apenas para OAuth.
