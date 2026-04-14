# Backlog Priorizado — Super Cardápio

> Lista completa de tasks ordenadas por valor + dependências.  
> Status: `[ ]` Pendente · `[x]` Concluído · `[~]` Em andamento

---

## Must Have (MVP)

| # | Task | Story | Epic | Pts | Sprint |
|---|---|---|---|---|---|
| 1 | TASK-001: Monorepo + config base | Setup | 00-Infra | 3 | 1 |
| 2 | TASK-004: Redis setup | Setup | 00-Infra | 2 | 1 |
| 3 | TASK-005: CI/CD GitHub Actions | Setup | 00-Infra | 3 | 1 |
| 4 | TASK-006: Socket.io setup | Setup | 00-Infra | 3 | 1 |
| 5 | TASK-007: Rate limiting + segurança | Setup | 00-Infra | 3 | 1 |
| 6 | TASK-002: Prisma schema + migration | Setup | 00-Infra | 5 | 1 |
| 7 | TASK-003: Seed de dados | Setup | 00-Infra | 2 | 1 |
| 8 | TASK-010: Auth JWT + login | Auth | 01-Auth | 5 | 2 |
| 9 | TASK-011: OAuth Google + Facebook | Auth | 01-Auth | 5 | 2 |
| 10 | TASK-012: Middleware multi-tenant | Auth | 01-Auth | 3 | 2 |
| 11 | TASK-013: Magic link cliente | Auth | 01-Auth | 3 | 2 |
| 12 | TASK-014: Auth motoboy + RBAC | Auth | 01-Auth | 5 | 2 |
| 13 | TASK-020: Owner dashboard + listagem | US-001 | 02-Owner | 3 | 3 |
| 14 | TASK-030: Stripe integração + webhooks | US-012 | 02-Owner | 13 | 3 |
| 15 | TASK-021: Owner criar nova loja | US-001 | 02-Owner | 8 | 3 |
| 16 | TASK-022: Owner editar/cancelar loja | US-001 | 02-Owner | 3 | 4 |
| 17 | TASK-023: Upgrade/downgrade planos | US-002 | 02-Owner | 5 | 4 |
| 18 | TASK-024: Audit logs por loja | US-001 | 02-Owner | 2 | 4 |
| 19 | TASK-042: Cloudinary upload | US-003 | 03-Catalogo | 3 | 4 |
| 20 | TASK-040: CRUD de categorias | US-003 | 03-Catalogo | 3 | 4 |
| 21 | TASK-053: Cadastro de motoboys | US-003B | 04-Config | 3 | 4 |
| 22 | TASK-050: Config dados + horários | US-003B | 04-Config | 5 | 4-5 |
| 23 | TASK-041: Produtos CRUD individual | US-003 | 03-Catalogo | 8 | 5 |
| 24 | TASK-043: Importação massa CSV/XLSX | US-003 | 03-Catalogo | 5 | 5 |
| 25 | TASK-051: Config WhatsApp + Pix | US-003B | 04-Config | 3 | 5 |
| 26 | TASK-052: Config formas de pagamento | US-003B | 04-Config | 3 | 5 |
| 27 | TASK-060: Cardápio público + perf | US-005 | 05-Cardapio | 8 | 6 |
| 28 | TASK-061: Busca e filtros | US-005 | 05-Cardapio | 3 | 6 |
| 29 | TASK-062: Loja fechada/suspensa | US-005 | 05-Cardapio | 2 | 6 |
| 30 | TASK-063: Carrinho de compras | US-006 | 05-Cardapio | 5 | 6 |
| 31 | TASK-064: Checkout: identificação + endereço | US-006 | 05-Cardapio | 5 | 7 |
| 32 | TASK-065: Checkout: pagamento + criar pedido | US-006 | 05-Cardapio | 8 | 7 |
| 33 | TASK-066: Acompanhamento pedido (magic link) | US-006 | 05-Cardapio | 3 | 7 |
| 34 | TASK-080: Kanban pedidos em tempo real | US-009 | 06-Pedidos | 8 | 7 |
| 35 | TASK-070: Baileys setup + conexão | US-007 | 05-Cardapio | 5 | 8 |
| 36 | TASK-071: WhatsApp envio de status | US-007 | 05-Cardapio | 8 | 8 |
| 37 | TASK-081: Detalhe + ações do pedido | US-009 | 06-Pedidos | 5 | 8 |
| 38 | TASK-082: Atribuição de motoboy | US-009 | 06-Pedidos | 3 | 8 |
| 39 | TASK-083: Painel do motoboy (mobile) | US-009B | 06-Pedidos | 8 | 9 |
| 40 | TASK-086: Pix: QR Code + Copia e Cola | US-011 | 06-Pedidos | 5 | 9 |
| 41 | TASK-044: QR Code mesa + comanda | US-004 | 03-Catalogo | 13 | 9 |
| 42 | TASK-085: Histórico de pedidos | US-009 | 06-Pedidos | 3 | 10 |

**Total MVP:** ~190 story points · ~9 sprints · ~18 semanas

---

## Should Have (v1.1)

| # | Task | Story | Epic | Pts | Sprint |
|---|---|---|---|---|---|
| 43 | TASK-054: Blacklist e whitelist | US-003C | 04-Config | 8 | 10 |
| 44 | TASK-095: Controle de caixa | US-018 | 07-Extras | 16 | 10 |
| 45 | TASK-093: Analytics dashboard | US-016 | 07-Extras | 13 | 11 |
| 46 | TASK-094: Ranking de clientes | US-019 | 07-Extras | 8 | 11 |
| 47 | TASK-090: Cupons de desconto | US-013 | 07-Extras | 8 | 12 |
| 48 | TASK-091: Área de entrega e taxas | US-014 | 07-Extras | 21 | 12-13 |
| 49 | TASK-084: Impressão automática | US-010 | 06-Pedidos | 8 | 14 |

**Total Should Have:** ~82 story points · ~4 sprints adicionais

---

## Could Have / Premium (v2.0)

| # | Task | Story | Epic | Pts | Sprint |
|---|---|---|---|---|---|
| 50 | TASK-072: IA Ollama WhatsApp | US-008 | 05-Cardapio | 34 | 13-16 |
| 51 | TASK-092: Agendamento de pedidos | US-015 | 07-Extras | 8 | 13 |
| 52 | TASK-096: Facebook Pixel | US-017 | 07-Extras | 5 | 13 |

**Total Could Have:** ~47 story points · ~2-4 sprints adicionais

---

## Epic 08 — Admin UI Redesign (v2.0) ✅

| # | Task | Story | Epic | Pts | Sprint |
|---|---|---|---|---|---|
| 53 | ~~TASK-100: Design tokens — cor primária vermelha~~ ✅ | UI v2.0 | 08-UI | 2 | 15 |
| 54 | ~~TASK-101: AdminLayout + AdminSidebar~~ ✅ | UI v2.0 | 08-UI | 8 | 15 |
| 55 | ~~TASK-102: StoreStatusToggle na sidebar~~ ✅ | UI v2.0 | 08-UI | 3 | 15 |
| 56 | ~~TASK-103: Badge pedidos novos na sidebar~~ ✅ | UI v2.0 | 08-UI | 2 | 15 |
| 57 | ~~TASK-104: Rotas PT + AdminLayout nas páginas~~ ✅ | UI v2.0 | 08-UI | 5 | 15 |
| 58 | ~~TASK-105: AdminDashboardPage completo~~ ✅ | UI v2.0 | 08-UI | 13 | 16 |
| 59 | ~~TASK-106: Redesign PedidosPage~~ ✅ | UI v2.0 | 08-UI | 8 | 16 |
| 60 | ~~TASK-107: Redesign ProdutosPage~~ ✅ | UI v2.0 | 08-UI | 5 | 16 |
| 61 | ~~TASK-108: Redesign CategoriasPage~~ ✅ | UI v2.0 | 08-UI | 3 | 17 |
| 62 | ~~TASK-109: AdicionaisPage nova~~ ✅ | UI v2.0 | 08-UI | 8 | 17 |
| 63 | ~~TASK-110: BairrosPage standalone~~ ✅ | US-010 | 08-UI | 5 | 17 |
| 64 | ~~TASK-111: HorariosPage standalone~~ ✅ | US-011 | 08-UI | 5 | 17 |
| 65 | ~~TASK-112: QRCodePage (renomear TablesPage)~~ ✅ | UI v2.0 | 08-UI | 2 | 17 |
| 66 | ~~TASK-113: Redesign MenuPage loja pública~~ ✅ | UI v2.0 | 08-UI | 8 | 18 |
| 67 | ~~TASK-114: ItemPage página dedicada~~ ✅ | UI v2.0 | 08-UI | 8 | 18 |
| 68 | ~~TASK-115: CheckoutDrawer lateral~~ ✅ | UI v2.0 | 08-UI | 8 | 18 |

**Total Epic 08:** 89 story points · Sprints 15–18 · **STATUS: CONCLUÍDO** ✅

---

## Epic 13 — Auto-cadastro + Trial Stripe + OAuth Opt-in (v2.5) ✅

| # | Task | Story | Epic | Pts | Sprint | Status |
|---|---|---|---|---|---|---|
| 69 | TASK-131: Padronização ENVs OAuth + flags `*_APP_ENABLE` | US-014 | 13-Auth | 2 | 19 | ✅ |
| 70 | TASK-132: Endpoint `GET /api/v1/auth/config` | US-014 | 13-Auth | 1 | 19 | ✅ |
| 71 | TASK-133: `useAuthConfig` + LoginForm condicional | US-014 | 13-Auth | 2 | 19 | ✅ |
| 72 | TASK-134: Migration `StoreSegment` + 7 campos endereço | US-001B | 13-Auth | 2 | 19 | ✅ |
| 73 | TASK-135: `register.schema.ts` Zod 12 campos | US-001B | 13-Auth | 1 | 19 | ✅ |
| 74 | TASK-136: `createSubscription(trialDays?)` + rollback | US-001B | 13-Auth | 1 | 19 | ✅ |
| 75 | TASK-137: `sendWelcomeSelfRegisterEmail()` | US-001B | 13-Auth | 1 | 19 | ✅ |
| 76 | TASK-138: `register.service` transacional + rollback | US-001B | 13-Auth | 3 | 19 | ✅ |
| 77 | TASK-139: Controller + rota rate-limited | US-001B | 13-Auth | 1 | 19 | ✅ |
| 78 | TASK-1310: Constants `SEGMENT_OPTIONS`, `BR_STATES`, `BENEFITS` | US-001B | 13-Auth | 0.5 | 19 | ✅ |
| 79 | TASK-1311: `RegisterStorePage` landing + form 12 campos | US-001B | 13-Auth | 2 | 19 | ✅ |
| 80 | TASK-1312: `useViaCep` + máscaras CEP/WhatsApp | US-001B | 13-Auth | 1.5 | 19 | ✅ |
| 81 | TASK-1313: Mutation `useRegisterStore` + erros | US-001B | 13-Auth | 1 | 19 | ✅ |
| 82 | TASK-1314: Rota `/cadastro` + link no LoginPage | US-001B | 13-Auth | 1 | 19 | ✅ |
| 83 | TASK-1315: E2E Playwright (6 cenários) | US-001B/014 | 13-Auth | 2 | 19 | ✅ |
| 84 | TASK-1316: Atualização Spec + Architecture + Changelog v2.5 | Docs | 13-Auth | 1 | 19 | ✅ |

**Total Epic 13:** ~23 story points · Sprint 19 · **STATUS: CONCLUÍDO 2026-04-10** ✅
**Breaking Change:** ENVs OAuth renomeadas (`GOOGLE_CLIENT_ID/SECRET` → `GOOGLE_APP_ID/SECRET`) — janela de rollback ≥48h.

---

## Won't Have (fora do escopo atual)

- Integração iFood/Rappi
- App nativo (iOS/Android)
- Pagamento automático (gateway integrado — MVP é manual via Pix)
- Multi-idioma
- Gestão de estoque
- Sistema de fidelidade com pontos

---

## Legenda de Feature Flags

| Feature | Plano 1 (Profissional) | Plano 2 (Premium) |
|---|---|---|
| `whatsappStatus` | ✅ | ✅ |
| `analytics` | ✅ | ✅ |
| `customer_ranking` | ✅ | ✅ |
| `cashflow` | ✅ | ✅ |
| `qrcode_table` | ✅ | ✅ |
| `coupon_redeem` | ✅ (campo visível) | ✅ |
| `whatsappAI` | ❌ | ✅ |
| `coupon_manage` | ❌ | ✅ |
| `auto_print` | ❌ | ✅ |
| `delivery_area` | ❌ | ✅ |
| `schedule` | ❌ | ✅ |
| `facebook_pixel` | ❌ | ✅ |
| `customDomain` | ❌ | Add-on +R$20/mês |

---

## Gates Obrigatórios (checklist pré-code)

Antes de iniciar qualquer task, confirmar:

- [ ] Testes definidos antes da implementação (TDD)?
- [ ] Nenhuma credencial hardcoded? `.env.example` atualizado?
- [ ] Feature isolada como módulo em `src/modules/`?
- [ ] Query filtra por `storeId`? (multi-tenant — CRÍTICO)
- [ ] Feature flag validada antes de executar recurso premium?
- [ ] Usa stack definida (React + Vite + Express + Prisma)?
- [ ] Código passa ESLint + Prettier?
- [ ] Zero erros TypeScript, zero `@ts-ignore` sem comentário?
- [ ] Toda API route tem schema Zod de validação?
- [ ] Upload via Cloudinary (nunca filesystem local)?
- [ ] Cache key inclui `storeId`? Mutação invalida `menu:{storeId}`?
- [ ] Touch targets ≥44px? CSS começa sem prefixo (mobile-first)?
- [ ] Ação sensível? Confirma senha + registra em AuditLog? (CRÍTICO)
