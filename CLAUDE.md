# Claude — Instruções do projeto

Este arquivo é lido automaticamente pelo Claude Code em toda conversa neste repositório. Descreve convenções que **devem** ser seguidas ao gerar ou editar código, pra que o lint e o CI nunca quebrem por coisa boba.

## Monorepo

- Workspaces npm: `api/` (backend Express + Prisma) e `web/` (Vite + React).
- Scripts do workspace raiz:
  - `npm test` — roda api (jest) + web (vitest run)
  - `npm run lint` — roda eslint nos dois
  - `npm run lint:fix` — auto-fix nos dois
  - `npm run typecheck` — tsc --noEmit nos dois
  - `npm run build` — build api + web

## Antes de declarar uma tarefa concluída

**Sempre** nessa ordem quando alterar código TypeScript:

1. `npm run lint:fix` — aplica auto-fix (import-order, formatação trivial).
2. `npm run lint` — confirma que sobrou só warnings, zero errors.
3. `npm test` — todos os testes passando.

Se o usuário pediu algo específico (fix de um bug, nova feature), você pode rodar só o sub-escopo relevante (ex: `npx jest --runInBand path/to/test.ts` no api). Mas, antes de reportar "pronto", rode o `lint:fix` + `lint` completos pra garantir que o CI não vai quebrar.

## Convenções de código

### Import-order (ESLint: `import/order` como `error`)

Ordem dos grupos, com **linha em branco entre cada grupo**:

1. `builtin` — módulos nativos do node (`fs`, `path`, `http`, `node:crypto`, ...)
2. `external` — dependências npm (`express`, `react`, `@prisma/client`, ...)
3. `internal` — aliases configurados (não usamos atualmente)
4. `parent` — imports de `../...`
5. `sibling` — imports de `./...`
6. `index` — imports de `./` (raro)

Exemplo ([api/src/shared/middleware/tenant.middleware.ts](api/src/shared/middleware/tenant.middleware.ts)):

```ts
import { NextFunction, Request, Response } from 'express'  // external

import { prisma } from '../prisma/prisma'                  // parent

import { AppError } from './error.middleware'              // sibling
```

Quando em dúvida, deixa o `eslint --fix` ordenar — ele é a fonte da verdade.

### `no-explicit-any` (ESLint: `warn`)

Existe como **warning** (não quebra o CI), mas **não adicione novos `any`** em código de produção. Sempre que precisar de um tipo frouxo, prefira:

- `unknown` + narrowing com `typeof` / `instanceof` / schema Zod
- Tipo genuíno do Prisma/biblioteca (ex: `Prisma.OrderGetPayload<...>`)
- Um type alias local se a forma é recorrente

Em **arquivos de teste** (`__tests__/**`, `*.test.ts`, `tests/**`) a regra é desligada — fique à vontade com `as any` em setup de mocks complexos.

### Prisma Client

- O client é gerado em `node_modules/.prisma/client` (hoisted pela workspace).
- `api/package.json` tem `postinstall: prisma generate`, então `npm ci` já regenera em CI. Nunca commite uma PR que dependa de rodar `prisma generate` manualmente.
- Se alterar `api/prisma/schema.prisma`, rode `npm run db:generate -w api` pra atualizar localmente.
- `api/src/modules/admin/orders.service.ts` importa `OrderStatus` e `OrderType` diretamente de `@prisma/client`. Se esses enums não aparecerem, o client está stale — rode `db:generate`.

### Testes

- **api**: `jest` com `ts-jest` preset. Config em [api/jest.config.js](api/jest.config.js). Rodar sempre com `--runInBand` (tem suítes que tocam Redis/DB em ordem).
- **web**: `vitest run` (o CI usa `run`, single-pass, não watch). `vitest` sem `run` entra em watch e trava no CI — **nunca** troque o script `test` de volta pra só `vitest`.

#### Gotchas conhecidos

1. **`jest.clearAllMocks()` só limpa calls, não implementations.** Se um teste setar `findFirst.mockResolvedValue(x)` e o próximo não sobrescrever, o mock vaza. Padrão atual na base: `jest.resetAllMocks()` no `beforeEach` + re-setup dos mocks top-level críticos.

2. **`resetAllMocks` limpa também `mockResolvedValue` de mocks top-level criados via `jest.mock(...)` factory.** Se você mocka `jsonwebtoken`, `qrcode`, `pdfkit`, etc. no topo do arquivo e usa `resetAllMocks` no beforeEach, o return value some. Solução: re-aplicar `.mockResolvedValue(...)` no beforeEach. Ver [api/src/tests/integration/tables.routes.test.ts](api/src/tests/integration/tables.routes.test.ts) e [api/src/tests/integration/menu.routes.test.ts](api/src/tests/integration/menu.routes.test.ts) como referência.

3. **Middlewares `requireActiveStore` e `publicTenantMiddleware` chamam `prisma.store.findUnique`.** Toda suíte integration que bate em rotas `/admin/...` ou `/menu/...` precisa mockar `store` no prisma mock object **e** dar um default `.mockResolvedValue({ status: 'ACTIVE', slug: '...' })` no `beforeEach`, senão retorna 404/500.

4. **Schemas Zod exigem UUIDs reais.** IDs tipo `'client-1'`, `'cat-1'`, `'prod-1'` em payloads de integration test vão quebrar validação e você vai ver 400 em vez do status esperado. Use UUIDs (`'11111111-1111-4111-8111-111111111111'`).

5. **Subdomain routing — TASK-122.** A rota pública `GET /api/v1/menu` pega o slug do `req.hostname` via `publicTenantMiddleware`, não da URL. Em supertest use `.set('Host', '<slug>.cardapio.test')` — nunca `GET /api/v1/menu/:slug`.

6. **Mock de `prisma.coupon`.** Qualquer suíte que toque `/menu/*` (serviço `getMenu` ou `createOrder`) precisa mockar `coupon.findMany` (usado por `getActiveProductPromos`) **e** `coupon.findFirst` (usado pelo recalculo de `unitPrice` em `createOrder`) retornando `null`/`[]` no beforeEach, senão quebra com `TypeError: coupon.findFirst is not a function` ou 500. Ver [api/src/tests/integration/menu.routes.test.ts](api/src/tests/integration/menu.routes.test.ts) como referência.

### Envelope de erro da API

Erros do backend saem sempre como `{ success: false, error: '<mensagem>', code?: '<CODE>' }` — **não** `message`. O [errorHandler](api/src/shared/middleware/error.middleware.ts) traduz `AppError`, `ZodError` e `Error` genérico nesse shape. No frontend, leia de `err.response.data.error` (com fallback pra `message` por segurança).

### Convenções de rotas

- `DELETE` retorna `res.json({ success: true })` (status 200), **não** 204. É o padrão consistente em todos os controllers admin — não mude pra 204 sem alinhar antes.
- Validação de input vem via `schema.parse(req.body)` dentro do try/catch do controller. `ZodError` é capturado pelo `errorHandler` global e vira **400** com `details`. Erros de regra de negócio lançam `AppError` com status explícito (normalmente **422** pra regra, **404** pra não encontrado, **403** pra permissão).

### Uploads de imagem

`api/src/modules/admin/upload.service.ts` detecta o backend na primeira chamada:

- Se `CLOUDINARY_URL` ou o trio `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` estiver preenchido com valores reais → usa Cloudinary e retorna URL absoluta.
- Se estiver vazio ou com placeholder (`your-cloud-name`, etc.) → fallback em disco local: grava em `api/uploads/<storeId>/products/<uuid>.<ext>` e retorna caminho relativo `/uploads/<storeId>/products/<uuid>.ext`.

O Express serve `/uploads` estaticamente em [api/src/app.ts](api/src/app.ts) com header `Cross-Origin-Resource-Policy: cross-origin` (helmet bloqueia por default). Vite proxy em [web/vite.config.ts](web/vite.config.ts) roteia `/uploads` pra :3001 em dev.

O Zod `imageUrl` no [products.schema.ts](api/src/modules/admin/products.schema.ts) aceita URL absoluta **ou** caminho começando com `/uploads/` — não use `.url()` direto.

A pasta `api/uploads/` está no `.gitignore`.

### Re-autenticação para ações sensíveis

Backend: `POST /api/v1/auth/reauth` (requer JWT, valida `password` via `bcrypt.compare`). Implementado em [auth.service.ts](api/src/modules/auth/auth.service.ts) `reauth()`.

Frontend: componente reutilizável [ReauthModal](web/src/modules/auth/components/ReauthModal.tsx) renderiza **sem `<form>`** (evita o prompt "salvar senha" do Chrome) e usa `autoComplete="one-time-code"`. Usado antes de: criar/editar/duplicar produto, excluir produto/categoria/adicional.

**Axios interceptor** em [api.ts](web/src/shared/lib/api.ts) tem uma lista `SKIP_AUTO_LOGOUT_ON_401` com `/auth/reauth` e `/auth/login` — 401 nessas rotas é "senha incorreta", não "sessão inválida". Qualquer outra rota que retorne 401 derruba a sessão.

### Promoções por produto (Coupon.productId)

O model `Coupon` cobre dois casos:

1. **Cupom clássico** — `code + type + value`, aplicado no checkout via `validateCoupon(storeId, code)`.
2. **Promoção por produto** — `productId + promoPrice + startsAt? + expiresAt?`. Auto-aplicada no cardápio público, sem código (auto-gerado como `PROMO_xxx`). O menu exibe preço riscado quando há promo ativa; `createOrder` recalcula `unitPrice` consultando a promo no banco — cliente nunca dita o preço.

Helper `getActiveProductPromos(storeId)` em [coupons.service.ts](api/src/modules/admin/coupons.service.ts) retorna Map\<productId, {promoPrice, startsAt, expiresAt}> das promos vigentes agora. Promo **não se aplica** a produtos com variations (variação tem preço próprio). `validateCoupon` ignora cupons com `productId` (não servem pra checkout manual).

### ENV e domínios

Ver [.claude/projects/.../memory/](memory que o Claude já mantém) sobre:
- 3 `.env`s: `api/.env`, `web/.env`, `.env` raiz (só LAN_IP pro docker-compose)
- `PUBLIC_ROOT_DOMAIN` / `VITE_PUBLIC_ROOT_DOMAIN` lido inline em ~10 arquivos (sem helper — decisão deliberada)
- Railway não suporta wildcard subdomain → cardápio público exige DNS wildcard real, não o subdomain free do Railway

### Commit

Só fazer commit quando o usuário pedir explicitamente. Nunca usar `--no-verify`. Nunca pushar sem pedido.
