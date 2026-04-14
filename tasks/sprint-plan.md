# Sprint Plan — Super Cardápio

> Planejamento de sprints de 2 semanas (10 dias úteis). Velocidade: ~21 pts/sprint (1 dev solo + IA).

---

## Sprint 1 — Fundação (Semanas 1-2)

**Goal:** Projeto rodando localmente com banco, auth, e estrutura base  
**Total:** 21 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-001 | Monorepo + configuração base | 3 | — |
| TASK-004 | Redis setup | 2 | TASK-001 |
| TASK-005 | CI/CD GitHub Actions | 3 | TASK-001 |
| TASK-006 | Socket.io setup | 3 | TASK-001 |
| TASK-007 | Rate limiting e segurança | 3 | TASK-001 |
| TASK-002 | Prisma schema + migration | 5 | TASK-001 |
| TASK-003 | Seed de dados | 2 | TASK-002 |

**Review:** Projeto sobe localmente. PostgreSQL, Redis, Socket.io funcionando. CI verde.

---

## Sprint 2 — Auth Completo (Semanas 3-4)

**Goal:** Login, JWT, OAuth, RBAC e multi-tenant funcionando  
**Total:** 21 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-010 | Auth JWT + login email/senha | 5 | TASK-002 |
| TASK-011 | OAuth Google e Facebook | 5 | TASK-010 |
| TASK-012 | Middleware multi-tenant | 3 | TASK-010 |
| TASK-013 | Magic link do cliente | 3 | TASK-010 |
| TASK-014 | Auth motoboy + RBAC | 5 | TASK-011, TASK-012 |

**Review:** Todos os roles conseguem fazer login. Isolamento multi-tenant confirmado via testes.

---

## Sprint 3 — Owner + Stripe (Semanas 5-6)

**Goal:** Owner consegue criar lojas e billing Stripe funcionando  
**Total:** 21 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-020 | Owner dashboard + listagem | 3 | TASK-010 |
| TASK-030 | Stripe integração + webhooks | 13 | TASK-010 |
| TASK-021 | Owner criar nova loja | 8 | TASK-020, TASK-030 |

> ⚠️ **Atenção:** Sprint com 24 pts. Considerar mover TASK-021 parcialmente para Sprint 4 se necessário.

**Review:** Owner cria loja → Admin recebe email → Stripe subscription criada → Webhook funciona.

---

## Sprint 4 — Owner Completo + Cloudinary (Semanas 7-8)

**Goal:** CRUD completo de lojas + upload de imagens funcionando  
**Total:** 21 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-022 | Owner editar/cancelar loja | 3 | TASK-021 |
| TASK-023 | Upgrade/downgrade de planos | 5 | TASK-022, TASK-030 |
| TASK-024 | Audit logs por loja | 2 | TASK-021 |
| TASK-042 | Cloudinary upload | 3 | TASK-001 |
| TASK-040 | CRUD de categorias | 3 | TASK-012 |
| TASK-053 | Cadastro de motoboys | 3 | TASK-010 |
| TASK-050 | Config: dados da loja + horários | 2 | TASK-012 |

**Review:** Ciclo completo de gestão de lojas. Upload de imagens funcional.

---

## Sprint 5 — Cardápio Admin (Semanas 9-10)

**Goal:** Admin consegue criar e gerenciar o cardápio completo  
**Total:** 19 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-041 | Produtos CRUD individual | 8 | TASK-040, TASK-042 |
| TASK-043 | Importação em massa CSV/XLSX | 5 | TASK-041 |
| TASK-051 | Config: WhatsApp e Pix (reauth) | 3 | TASK-050 |
| TASK-052 | Config: formas de pagamento | 3 | TASK-050 |

**Review:** Admin consegue cadastrar todo o cardápio (individual + massa). Configurações básicas prontas.

---

## Sprint 6 — Cardápio Público (Semanas 11-12)

**Goal:** Cardápio público mobile-first funcionando com performance  
**Total:** 18 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-060 | Cardápio público + performance | 8 | TASK-041, TASK-004 |
| TASK-061 | Busca e filtros | 3 | TASK-060 |
| TASK-062 | Loja fechada e suspensa | 2 | TASK-060 |
| TASK-063 | Carrinho de compras | 5 | TASK-060 |

**Review:** Cardápio público mobile-first. Lighthouse ≥ 85. Carrinho funcionando.

---

## Sprint 7 — Checkout e Pedidos (Semanas 13-14)

**Goal:** Cliente consegue fazer pedido completo. Admin vê no Kanban.  
**Total:** 23 pts

> ⚠️ Sprint pesada. Prioridade máxima — é o coração do produto.

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-064 | Checkout: identificação + endereço | 5 | TASK-063 |
| TASK-065 | Checkout: pagamento + criação pedido | 8 | TASK-064 |
| TASK-066 | Acompanhamento pedido (magic link) | 3 | TASK-065, TASK-013 |
| TASK-080 | Kanban de pedidos em tempo real | 8 | TASK-065, TASK-006 |

**Review:** Ciclo completo: cliente faz pedido → admin vê no Kanban em tempo real.

---

## Sprint 8 — WhatsApp + Motoboy (Semanas 15-16)

**Goal:** Notificações WhatsApp funcionando. Motoboy tem painel próprio.  
**Total:** 21 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-070 | Baileys setup + conexão | 5 | TASK-001 |
| TASK-071 | WhatsApp envio de status | 8 | TASK-070, TASK-065 |
| TASK-081 | Detalhe + ações do pedido | 5 | TASK-080 |
| TASK-082 | Atribuição de motoboy | 3 | TASK-080, TASK-071 |

**Review:** Cliente recebe WhatsApp em cada mudança de status. Motoboy acionado via WhatsApp.

---

## Sprint 9 — Motoboy Painel + Pix + QR Code (Semanas 17-18)

**Goal:** Motoboy tem painel completo. Pix funcionando. MVP quase pronto.  
**Total:** 21 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-083 | Painel do motoboy (mobile) | 8 | TASK-014, TASK-071 |
| TASK-086 | Pix: QR Code e Copia e Cola | 5 | TASK-051 |
| TASK-044 | QR Code de mesa e comanda | 13 | TASK-041, TASK-006 |

> ⚠️ Sprint com 26 pts. Mover TASK-044 para Sprint 10 se necessário.

**Review:** Motoboy marca entregue → cliente notificado. Pix funcional. QR de mesa funcionando.

---

## Sprint 10 — Caixa + Blacklist + Analytics (Semanas 19-20)

**Goal:** Controle financeiro e funcionalidades de gestão completas.  
**Total:** 21 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-054 | Blacklist e whitelist | 8 | TASK-052 |
| TASK-095 | Controle de caixa | 16 | TASK-065, TASK-010 |

> ⚠️ Sprint com 24 pts. Ajustar conforme velocidade real.

**Review:** Caixa abre/fecha automaticamente. Blacklist controla pagamento na entrega.

---

## Sprint 11 — Analytics + Ranking + Cupons (Semanas 21-22)

**Goal:** Funcionalidades de negócio Should Have completadas.  
**Total:** 21 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-093 | Analytics dashboard | 13 | TASK-065 |
| TASK-094 | Ranking de clientes | 8 | TASK-065 |

> ⚠️ Sprint com 21 pts. OK.

**Review:** Admin tem visão de vendas, top produtos, horários de pico, ranking de clientes.

---

## Sprint 12 — Premium Features (Semanas 23-24)

**Goal:** Features Premium completas (Plano 2 entregável).  
**Total:** 21 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-090 | Cupons de desconto | 8 | TASK-064 |
| TASK-091 | Área de entrega e taxas | 21 | TASK-064 |

> ⚠️ Sprint muito pesada (29 pts). Dividir TASK-091 em subtasks menores para 2 sprints.

**Review:** Cupons funcionando. Taxa de entrega por bairro e por distância calculada no checkout.

---

## Sprint 13 — IA WhatsApp + Agendamento + Pixel (Semanas 25-26)

**Goal:** IA Premium funcionando. Agendamento. Facebook Pixel.  
**Total:** 47 pts (distribuir em múltiplas sprints se necessário)

| Task | Descrição | Pts |
|---|---|---|
| TASK-072 | IA Ollama WhatsApp | 34 |
| TASK-092 | Agendamento de pedidos | 8 |
| TASK-096 | Facebook Pixel | 5 |

> ⚠️ IA é a task mais complexa (34 pts). Planejar 4-6 sprints para esta task isoladamente.  
> Sugestão: dividir TASK-072 em subtasks de 5-8 pts cada.

**Review:** IA responde dúvidas e gera link de carrinho pré-montado.

---

## Sprint 14 — Impressão + Estabilização (Semanas 27-28)

**Goal:** Impressão automática. Estabilização e correções pré-lançamento.  
**Total:** 8 pts + buffer

| Task | Descrição | Pts |
|---|---|---|
| TASK-084 | Impressão automática ESC/POS | 8 |
| Buffer | Correções e ajustes | — |

---

## Sprint 15 — Admin UI Redesign: Base (Semanas 29-30)

**Goal:** Sidebar funcional em todas as páginas admin. Design tokens vermelhos aplicados.  
**Total:** 20 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-100 | Design tokens — cor primária vermelha | 2 | — |
| TASK-101 | AdminLayout + AdminSidebar | 8 | TASK-100 |
| TASK-102 | StoreStatusToggle na sidebar | 3 | TASK-101 |
| TASK-103 | Badge pedidos novos na sidebar | 2 | TASK-101 |
| TASK-104 | Rotas PT + AdminLayout em todas as páginas | 5 | TASK-101 |

**Review:** Sidebar com 9 itens aparece em todas as páginas `/admin/*`. Toggle e badge funcionam.

---

## Sprint 16 — Admin UI Redesign: Dashboard + Pedidos + Produtos (Semanas 31-32)

**Goal:** Dashboard completo. Pedidos e Produtos redesenhados.  
**Total:** 26 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-105 | AdminDashboardPage completo | 13 | TASK-104 |
| TASK-106 | Redesign PedidosPage — Kanban + filtros | 8 | TASK-104 |
| TASK-107 | Redesign ProdutosPage — pills + ordenação | 5 | TASK-104 |

> ⚠️ Sprint com 26 pts. Mover TASK-107 para Sprint 17 se necessário.

**Review:** Dashboard com KPIs, gráfico e ranking. Kanban de pedidos com filtros por tipo.

---

## Sprint 17 — Admin UI Redesign: Páginas Standalone (Semanas 33-34)

**Goal:** Categorias, Adicionais, Bairros, Horários e QRCode como páginas standalone.  
**Total:** 23 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-108 | Redesign CategoriasPage — formulário inline | 3 | TASK-104 |
| TASK-109 | AdicionaisPage — nova página com grupos | 8 | TASK-104 |
| TASK-110 | BairrosPage — página standalone | 5 | TASK-104 |
| TASK-111 | HorariosPage — página standalone | 5 | TASK-104 |
| TASK-112 | QRCodePage — renomear TablesPage | 2 | TASK-104 |

**Review:** Todos os 9 itens da sidebar têm páginas funcionais. Bairros e Horários standalone.

---

## Sprint 18 — Loja Pública Redesign (Semanas 35-36)

**Goal:** Loja pública com store header card, grid de produtos, página de item e checkout drawer.  
**Total:** 24 pts

| Task | Descrição | Pts | Dependências |
|---|---|---|---|
| TASK-113 | Redesign MenuPage — store header + grid | 8 | — |
| TASK-114 | ItemPage — página dedicada de produto | 8 | TASK-113 |
| TASK-115 | CheckoutDrawer — drawer lateral | 8 | TASK-114 |

**Review:** Loja pública com header card, grid 3 colunas, página de item dedicada e checkout em drawer.

---

## Sprint 14 — WhatsApp Mode + Auth Session (Sprint v2.1)

**Goal:** 7 mudanças solicitadas pelo cliente: WhatsApp Mode enum, sidebar WhatsApp, templates de mensagens, AI pipeline NLP→SQL, logout admin/owner, sessionStorage auth, fix admins adicionais.  
**Total:** 53 pts  
**Referência:** `.specify/tasks/epic-09-whatsapp-auth-sprint14.md`

| Task | Descrição | Pts | Fase |
|---|---|---|---|
| TASK-091 | Sidebar admin — item WhatsApp + badge status | 2 | 1 — Bugfix |
| TASK-092 | Botão logout Admin + Owner | 2 | 1 — Bugfix |
| TASK-093 | Migrar auth localStorage → sessionStorage | 3 | 1 — Bugfix |
| TASK-094 | Fix link "Admins Adicionais" quebrado | 1 | 1 — Bugfix |
| TASK-095 | Migration DB — WhatsAppMode + WhatsAppTemplate + AIInteractionLog | 3 | 2 — Schema |
| TASK-096 | API — WhatsApp Mode na criação/edição de loja | 3 | 2 — API |
| TASK-097 | API — WhatsApp Message Templates + refactor messages.service | 5 | 2 — API |
| TASK-098 | UI — campo whatsappMode em NewStorePage + StoreDetailPage | 3 | 3 — UI |
| TASK-099 | UI — aba "Mensagens WhatsApp" em SettingsPage | 5 | 3 — UI |
| TASK-0910 | API + UI — Admins Adicionais por Loja (full-stack) | 8 | 3 — UI |
| TASK-0911 | AI Pipeline — NLP→SQL + rate limit Redis | 13 | 4 — AI |
| TASK-0912 | Testes E2E + Integration Suite Sprint 14 | 5 | 4 — QA |

> ⚠️ Sprint com 53 pts (acima da velocidade). Executar em 4 fases; Fase 4 pode escorregar para Sprint 15 se necessário.

**Review:** Sidebar WhatsApp funcional. Logout em todos os papéis. Auth por session. Templates editáveis. Admins adicionais. Pipeline IA completo.

---

## Sprint 15-16 — WhatsApp Chat em Tempo Real (Sprint v2.2)

**Goal:** Chat WhatsApp em tempo real no painel admin, humano assume/devolve conversa, WhatsApp page com 3 tabs, templates GREETING + ABSENCE.  
**Total:** ~46 pts  
**Referência:** `.specify/tasks/epic-10-whatsapp-chat-realtime.md`  
**Referência código:** `/Users/mfabiodias/Sites/Projects/personal-ai`

| Task | Descrição | Pts | Fase |
|---|---|---|---|
| TASK-101 | Migration DB — Conversation + ConversationMessage + GREETING/ABSENCE | 3 | 1 — DB |
| TASK-102 | Conversations Service (adaptar de personal-ai, multi-tenant) | 3 | 1 — Backend |
| TASK-103 | API — Rotas de Conversação Admin (5 endpoints) | 2 | 1 — API |
| TASK-104 | Baileys Handler — Salvar msgs + GREETING + ABSENCE + isHumanMode | 5 | 1 — Backend |
| TASK-105 | Templates GREETING + ABSENCE nos Defaults + API | 1 | 1 — Backend |
| TASK-106 | Testes Integração — Backend Chat | 3 | 1 — QA |
| TASK-107 | Socket.io — Rooms por Loja + Eventos de Conversa | 3 | 2 — Socket |
| TASK-108 | Frontend Hook useConversations (React Query + Socket.io) | 2 | 2 — Frontend |
| TASK-109 | TASK-099 Redirect — Mover WhatsAppMessagesTab de SettingsPage | 1 | 2 — Refactor |
| TASK-110 | Testes Socket.io | 2 | 2 — QA |
| TASK-111 | Refatorar WhatsAppPage — 3 Tabs | 3 | 3 — UI |
| TASK-112 | UI — WhatsAppChatTab (Lista de Conversas) | 5 | 3 — UI |
| TASK-113 | UI — ConversationView (Chat em Tempo Real, adaptar personal-ai) | 5 | 3 — UI |
| TASK-114 | UI — WhatsAppMessagesTab (11 templates com GREETING + ABSENCE) | 3 | 3 — UI |
| TASK-115 | Testes E2E — Chat em Tempo Real + Humano Assume | 5 | 3 — QA |

> ⚠️ Sprint com ~46 pts. Dividir: Sprint 15 = Fases 1+2; Sprint 16 = Fase 3.  
> ⚠️ TASK-099 (Epic 09): se não implementada → skip; templates vão direto para WhatsApp page.

**Review:** Chat em tempo real funcionando. Admin assume/devolve conversa. GREETING + ABSENCE automáticos. WhatsApp page com 3 tabs.

---

## Sprint 17 — Subdomain Routing + Infra Deploy (Sprint v2.3)

**Goal:** Migrar roteamento path-based → subdomain. Suporte a domínio próprio por loja. Deploy automático com health check. Dev local com SSL via mkcert.  
**Total:** ~17 pts  
**Referência:** `.specify/tasks/epic-11-infra-deploy.md`  
**Referência:** `.specify/changelog/v2.3-migration.md`

| Task | Descrição | Pts | Fase |
|---|---|---|---|
| TASK-121 | Schema — campo `customDomain` + migration | 1 | 1 — DB |
| TASK-125 | vite.config.ts HTTPS + docs setup local (mkcert) | 1 | 1 — Dev |
| TASK-117 | Criar `GET /health` endpoint na API | 1 | 2 — Backend |
| TASK-122 | Tenant middleware — subdomain + customDomain lookup | 3 | 2 — Backend |
| TASK-123 | Hook `useStoreSlug` no frontend | 2 | 3 — Frontend |
| TASK-124 | React Router — remover `/:slug` de todas as rotas | 3 | 3 — Frontend |
| TASK-116 | CI/CD — job deploy + health check + rollback | 2 | 4 — Infra |
| TASK-118 | `.env.production.example` documentado | 1 | 4 — Infra |
| TASK-119 | Dockerfiles + docker-compose.prod.yml + Caddyfile wildcard | 2 | 4 — Infra |
| TASK-120 | Staging Railway (`develop` branch) | 1 | 4 — Infra |
| TASK-126 | Pós go-live: QR Codes + WhatsApp templates + OAuth URLs | 1 | 5 — Pós |

> ⚠️ Sprint com ~17 pts (acima da velocidade de 21). Executar Fases 1-3 primeiro (bloqueantes). Fase 5 pode ir para Sprint 18.  
> ⚠️ Breaking change: remover `/:slug` quebra todos os links path-based. Executar antes do primeiro deploy em produção.

**Review:** `https://demo.cardapio.test:5173` funciona localmente com SSL. Loja com domínio próprio (`supercardapio.test`) resolve corretamente. Deploy automático no Railway com health check. Staging em `develop`.

---

## Sprint 19 — Auto-cadastro + Trial Stripe + OAuth Opt-in (Sprint v2.5) ✅ CONCLUÍDA 2026-04-10

**Goal:** Self-service público em `/cadastro` com trial Stripe 7d sem cartão, email de boas-vindas, padronização ENVs OAuth (`GOOGLE_APP_ID/SECRET` + `*_APP_ENABLE`) e botões sociais condicionais no LoginForm.
**Total:** ~23 pts
**Referência:** `.specify/tasks/epic-13-self-register-trial-oauth.md`
**Referência:** `.specify/changelog/v2.5-migration.md`
**Status:** ✅ Todas as 16 tasks concluídas em 2026-04-10

| Task | Descrição | Pts | Fase |
|---|---|---|---|
| TASK-131 | Padronização ENVs OAuth + flags `*_APP_ENABLE` | 2 | 1 — Config |
| TASK-132 | Endpoint público `GET /api/v1/auth/config` | 1 | 1 — Config |
| TASK-133 | Hook `useAuthConfig()` + render condicional LoginForm | 2 | 2 — Frontend |
| TASK-134 | Migration — `StoreSegment` enum + 7 campos endereço | 2 | 3 — Schema |
| TASK-135 | `register.schema.ts` — Zod 12 campos + refine senhas | 1 | 4 — Backend |
| TASK-136 | `stripe.service` — `createSubscription(trialDays?)` + `cancelCustomerSafe` | 1 | 4 — Backend |
| TASK-137 | `email.service` — `sendWelcomeSelfRegisterEmail()` | 1 | 4 — Backend |
| TASK-138 | `register.service` — `registerStore()` transacional + rollback Stripe | 3 | 4 — Backend |
| TASK-139 | Controller + rota `POST /auth/register-store` (rate-limited) | 1 | 4 — Backend |
| TASK-1310 | Constants — `SEGMENT_OPTIONS`, `BR_STATES`, `BENEFITS` | 0.5 | 5 — Frontend |
| TASK-1311 | `RegisterStorePage.tsx` — Landing + formulário 12 campos | 2 | 5 — Frontend |
| TASK-1312 | `useViaCep()` + máscaras CEP/WhatsApp | 1.5 | 5 — Frontend |
| TASK-1313 | Mutation `useRegisterStore()` + tratamento de erros | 1 | 5 — Frontend |
| TASK-1314 | Rota `/cadastro` + link "Criar minha loja" no LoginPage | 1 | 5 — Frontend |
| TASK-1315 | E2E Playwright — 6 cenários (cadastro + flags OAuth) | 2 | 6 — QA |
| TASK-1316 | Atualização Spec + Architecture + Changelog v2.5 | 1 | 6 — Docs |

> ⚠️ Sprint com 23 pts (acima da velocidade nominal de 21). Buffer aceitável; Fase 6 (TASK-1315/1316) pode escorregar para Sprint 20 se necessário.
> ⚠️ **Breaking change:** ENVs OAuth renomeadas. Duplicar variáveis no Railway durante janela de rollback (≥48h após release).
> ⚠️ **Pacotes a verificar:** `slugify` e `express-rate-limit` (instalar se ausentes).

**Review:** Cliente acessa `/cadastro` → preenche 12 campos (CEP autocompleta) → loja criada com trial 7d sem cartão → email welcome enviado → logado em `/dashboard`. Login Google opt-in via flag. Botões sociais somem quando flag `false`.

---

## Resumo do Backlog

### MVP (Must Have — Sprints 1-9)
Sprints 1 a 9 entregam o MVP completo:
- Infra + Auth + Owner + Stripe
- Cardápio admin + público (mobile-first)
- Pedidos + Kanban + WhatsApp
- Motoboy + Pix + QR Code de mesa

### v1.1 (Should Have — Sprints 10-12)
- Caixa, Blacklist/Whitelist, Analytics, Ranking, Cupons, Área de entrega

### v2.0 (Premium + Could Have — Sprints 13+)
- IA WhatsApp, Agendamento, Facebook Pixel, Impressão automática

---

## Velocidade e Estimativas

| Métrica | Valor |
|---|---|
| Velocidade estimada | 21 pts/sprint (1 dev + IA) |
| Sprints para MVP | ~9 sprints (~18 semanas) |
| Total story points MVP | ~190 pts |
| Total story points backlog completo | ~316 pts |
| Número total de tasks | 47 tasks |
