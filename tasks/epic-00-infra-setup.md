# Epic 00 — Infraestrutura e Setup

> Fundação técnica do projeto. Deve ser concluída antes de qualquer outra epic.

**Total estimado:** 21 story points

---

## TASK-001: Monorepo e Configuração Base

**Epic:** 00-Infra  
**Story:** Setup geral  
**Estimativa:** 3 pts  
**Dependências:** Nenhuma

### Subtasks
- [x] Criar estrutura monorepo: `apps/web` (React+Vite) + `apps/api` (Express)
- [x] Configurar `package.json` raiz com workspaces
- [x] Configurar TypeScript strict em ambos os apps
- [x] Configurar ESLint + Prettier compartilhado
- [x] Criar `.env.example` com todas as variáveis necessárias
- [x] Criar `docker-compose.yml` para dev (PostgreSQL + Redis)
- [x] Criar `README.md` com instruções de setup local

### Critérios de Done
- [x] `npm run dev` sobe ambos os apps
- [x] TypeScript sem erros em ambos
- [x] ESLint + Prettier passando
- [x] Docker Compose sobe PostgreSQL e Redis localmente

### Arquivos Criados
- `package.json` (raiz)
- `apps/web/` (estrutura base Vite+React)
- `apps/api/` (estrutura base Express)
- `docker-compose.yml`
- `.env.example`

---

## TASK-002: Prisma — Schema e Migration Inicial

**Epic:** 00-Infra  
**Story:** Setup database  
**Estimativa:** 5 pts  
**Dependências:** TASK-001

### Subtasks
- [x] `npm install prisma @prisma/client` no `apps/api`
- [x] Copiar schema completo do architecture.md para `prisma/schema.prisma`
- [x] Revisar e confirmar todos os models: Store, User, RefreshToken, Category, Product, ProductVariation, ProductAdditional, Order, OrderItem, OrderItemAdditional, Table, Coupon, CashFlow, CashFlowItem, CashFlowAdjustment, BusinessHour, DeliveryNeighborhood, DeliveryDistance, ClientPaymentAccess, AuditLog
- [x] Criar todos os enums: Role, StorePlan, StoreStatus, OrderType, OrderStatus, OrderItemStatus, PaymentMethod, DeliveryMode, CouponType, CashFlowStatus, AdjustmentType, PixKeyType, AccessType
- [x] `npx prisma migrate dev --name init`
- [x] Verificar todos os índices criados (slug, storeId, status, createdAt)

### Critérios de Done
- [x] `prisma migrate dev` roda sem erros
- [x] Todos os models acessíveis via Prisma Client
- [x] Índices conferidos no banco
- [x] Schema exportado para TypeScript types

### Arquivos Criados
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/`

---

## TASK-003: Seed de Dados de Teste

**Epic:** 00-Infra  
**Story:** Setup database  
**Estimativa:** 2 pts  
**Dependências:** TASK-002

### Subtasks
- [x] Criar `prisma/seed.ts`
- [x] Seed cria 1 Owner (Uendell)
- [x] Seed cria 3 lojas de teste (para validar isolamento multi-tenant):
  - Loja A: `pizzaria-dona-maria` (plano PROFESSIONAL)
  - Loja B: `burguer-top` (plano PREMIUM)
  - Loja C: `sushi-express` (plano PROFESSIONAL, status SUSPENDED)
- [x] Seed cria 1 Admin por loja
- [x] Seed cria categorias e produtos de exemplo por loja
- [x] Seed cria 1 motoboy por loja
- [x] Configurar `prisma.config.ts` com seed script

### Critérios de Done
- [x] `npx prisma db seed` roda sem erros
- [x] 3 lojas isoladas com dados distintos
- [x] Login funciona para Owner, Admin e Motoboy de cada loja
- [x] Isolamento confirmado: Admin da Loja A não enxerga produtos da Loja B

---

## TASK-004: Redis e Configuração de Cache

**Epic:** 00-Infra  
**Story:** Setup cache  
**Estimativa:** 2 pts  
**Dependências:** TASK-001

### Subtasks
- [x] `npm install ioredis` no `apps/api`
- [x] Criar `src/lib/redis.ts` com conexão singleton via `REDIS_URL`
- [x] Implementar helpers: `get`, `set`, `del`, `setWithTTL`
- [x] Configurar TTLs padrão: `menu:{storeId}` 5min, `store:{storeId}` 10min, `features:{storeId}` 10min
- [x] Health check endpoint para Redis (`/health`)

### Critérios de Done
- [x] Conexão Redis funcional no Docker local
- [x] Helpers testados (unit)
- [x] Railway Redis Plugin documentado no `.env.example`

---

## TASK-005: CI/CD GitHub Actions

**Epic:** 00-Infra  
**Story:** Deploy pipeline  
**Estimativa:** 3 pts  
**Dependências:** TASK-001

### Subtasks
- [x] Criar `.github/workflows/ci.yml`
- [x] Job: lint (ESLint + Prettier)
- [x] Job: type-check (tsc --noEmit)
- [x] Job: tests (Vitest + Jest)
- [x] Job: build (vite build + tsc)
- [x] Configurar secrets no GitHub (DATABASE_URL_TEST, etc.)
- [x] Criar `railway.toml` com configuração de deploy

### Critérios de Done
- [x] PR cria checks automáticos (lint, types, tests, build)
- [x] Build passa no CI
- [x] Deploy automático no Railway após merge em `main`

---

## TASK-006: Socket.io — Setup Base

**Epic:** 00-Infra  
**Story:** Realtime  
**Estimativa:** 3 pts  
**Dependências:** TASK-001

### Subtasks
- [x] `npm install socket.io` (api) + `socket.io-client` (web)
- [x] Configurar Socket.io no Express server
- [x] Implementar rooms por store: `store:{storeId}`
- [x] Emitir evento `menu:updated` na atualização de produtos
- [x] Emitir evento `order:new` e `order:status` nos pedidos
- [x] Frontend: escutar `menu:updated` → invalidar TanStack Query
- [x] Frontend: escutar `order:new` → toast + atualizar Kanban

### Critérios de Done
- [x] Socket conecta sem erros
- [x] Admin abre cardápio + edita produto → cliente recebe atualização em <300ms
- [x] Teste de carga: 50 sockets simultâneos sem degradação

---

## TASK-007: Rate Limiting e Segurança Base

**Epic:** 00-Infra  
**Story:** Segurança  
**Estimativa:** 3 pts  
**Dependências:** TASK-001

### Subtasks
- [x] `npm install express-rate-limit helmet cors`
- [x] Rate limit: 100 req/min (rotas públicas), 1000 req/min (autenticadas)
- [x] Helmet (headers de segurança)
- [x] CORS configurado para domínios permitidos
- [x] Sanitização de input (express-validator ou zod em todas as rotas)
- [x] Validar que nenhuma credencial está hardcoded (review)
- [x] `.gitignore` com `.env*`

### Critérios de Done
- [x] `curl` acima de 100 req/min retorna 429
- [x] Headers de segurança presentes em todas as respostas
- [x] Nenhum secret no código fonte
