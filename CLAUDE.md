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
- Se estiver vazio ou com placeholder (`your-cloud-name`, etc.) → fallback em disco local: grava em `api/uploads/<storeId>/<tipo>/<uuid>.<ext>` e retorna caminho relativo `/uploads/<storeId>/<tipo>/<uuid>.ext`.

`POST /admin/upload` aceita query `?type=products|logos` (default `products`). O componente `ImageUpload` em [web/src/modules/admin/components/ImageUpload.tsx](web/src/modules/admin/components/ImageUpload.tsx) expõe a prop `uploadType` (`'products' | 'logos'`) — a tab Personalização passa `logos` pra separar logos de fotos de produtos no Cloudinary/disco.

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

### Adicionais (v2.9 — AddonCategory + Addon + ProductAddon)

Adicionais foram totalmente reformulados. O modelo antigo `ProductAdditional` (lista flat amarrada a 1 produto) foi substituído por 3 entidades:

- **`AddonCategory`** — agrupa adicionais por tema dentro da loja (ex: "Acompanhamentos", "Bebidas adicionais", "Sabores"). `@@unique([storeId, name])`.
- **`Addon`** — item adicional cadastrado **uma vez por loja**, com foto/preço/disponibilidade. Pertence a uma `AddonCategory`. `@@unique([storeId, categoryId, name])`.
- **`ProductAddon`** — tabela associativa N:N (`@@id([productId, addonId])`) ligando produto ao adicional, com `order` pra drag-and-drop no modal.

Sem regras de min/max/required — todos opcionais. Agrupamento é só visual: cardápio público renderiza adicionais agrupados por `addon.category.id`, e categoria só aparece se tem ≥1 adicional ativo vinculado ao produto.

**Migration de dados** ([20260521000000_addon_categories_v29](api/prisma/migrations/20260521000000_addon_categories_v29/migration.sql)): deduplica `ProductAdditional` existentes por `(storeId, name, price)` numa `AddonCategory "Geral"` por loja, e cria `ProductAddon` ligando cada produto ao Addon resultante. `OrderItemAdditional` (snapshot em pedidos) **não é tocado** — pedidos antigos seguem íntegros porque já guardam `name+price` congelados.

**Endpoints** em `/admin/additionals/*` (sidebar mantém "Adicionais"):
- `GET/POST/PATCH/DELETE /categories` — CRUD AddonCategory
- `GET/POST/PATCH/DELETE /` — CRUD Addon (filtro `?categoryId=`)
- `POST /:id/duplicate` — duplica addon (gera "X (Cópia)")
- `PUT /products/:productId { addonIds: string[] }` — substitui vínculos de um produto

**Frontend admin** ([AdicionaisPage.tsx](web/src/modules/admin/pages/AdicionaisPage.tsx)): tabs por categoria, lista addons inline com edição (nome/preço/foto/disponibilidade), botão "Nova categoria". Vínculo produto↔addon é feito em modal aberto pelo card do produto em [ProductsPage.tsx](web/src/modules/admin/pages/ProductsPage.tsx), via [ProductAddonsModal](web/src/modules/admin/components/ProductAddonsModal.tsx).

**Pedidos**: cliente envia `addonIds: string[]` (não mais `additionalIds`). `createOrder` valida via `ProductAddon` que cada Addon está vinculado ao produto antes de aceitar.

### ENV e domínios

Ver [.claude/projects/.../memory/](memory que o Claude já mantém) sobre:
- 3 `.env`s: `api/.env`, `web/.env`, `.env` raiz (só LAN_IP pro docker-compose)
- `PUBLIC_ROOT_DOMAIN` / `VITE_PUBLIC_ROOT_DOMAIN` lido inline em ~10 arquivos (sem helper — decisão deliberada)
- Railway não suporta wildcard subdomain → cardápio público exige DNS wildcard real, não o subdomain free do Railway

**Dev local — IP da máquina muda**: o dnsmasq resolve `*.cardapio.test` pra `LAN_IP` definido no `.env` raiz. Quando você troca de Wi-Fi/casa e o IP muda, o `cardapio.test` para de responder. Conserto rápido: ajustar `LAN_IP=` no `.env` e rodar `docker compose up -d --force-recreate dnsmasq`. Conserto completo (re-detecta IP, re-instala mkcert se preciso): `./infra/scripts/setup-dev.sh`.

### Mesas e sessões (TableSession)

Mesas funcionam como **sessões com token**. Não existe mais `?mesa=N` no link público — o QR code aponta pra `https://{slug}.{rootDomain}/mesa/:n` que é um entry-point ([TableEntryPage.tsx](web/src/modules/menu/pages/TableEntryPage.tsx)) que:

1. Busca/cria uma `TableSession` OPEN pra mesa via `POST /menu/table-session`.
2. Pede o nome do cliente ("Como devemos te chamar?") com botão "Sou convidado" pra pular.
3. Persiste `tableSessionToken` + `deviceName` no `useCartStore` (Zustand+localStorage).
4. Redireciona pra `/` (cardápio).

**Modelo `TableSession`**: `@@unique([tableId, status])` garante no banco que **só pode haver uma sessão OPEN por mesa**. Vários celulares na mesma mesa compartilham a sessão (segundo scan retorna o mesmo token). Pedidos da sessão recebem `tableSessionId` + `deviceName` (o nome aparece pra cozinha em `OrderItem.deviceName`).

**Pagamento de mesa**: enum `PaymentMethod` tem **valores limpos** pra mesa (`PIX | CASH | CREDIT | DEBIT`) e os antigos `*_ON_DELIVERY` continuam exclusivos pra delivery. Helper `isTablePaymentMethod()` em [payment.ts](api/src/shared/utils/payment.ts) valida no backend. O fluxo é em **dois passos**:

1. **`POST /admin/tables/:id/payment`** com `{ paymentMethod }` — `confirmTableSessionPayment` marca todos os pedidos da sessão com `paymentReceivedAt` + `paymentMethod`, sobe `WAITING_*` pra `CONFIRMED` (espelha o auto-confirm do PIX em OrdersPage), e chama `linkOrderToCashFlow` pra cada um (registra na fila aberta de CashFlow).
2. **`PATCH /admin/tables/:id/close`** com taxa de serviço opcional — `closeTable` marca `TableSession` como CLOSED, todos os orders viram `DELIVERED`, `Table.isOccupied` volta pra false. **Exige sessão paga** (todos os orders com `paymentReceivedAt`); se algum estiver pendente, retorna 422 "Receba o pagamento antes de fechar".

**Configuração da loja**: `Store.allowTable: Boolean @default(true)`. Quando `false`, o backend retorna 422 em `openOrJoinSession` e em `createOrder` com `type=TABLE`. O frontend esconde o item "Mesas" da sidebar admin. Toggle fica em [EntregasPage > Status](web/src/modules/admin/pages/EntregasPage.tsx) ao lado de Entrega e Retirada.

**Painel admin** ([MesasPage.tsx](web/src/modules/admin/pages/MesasPage.tsx)): segmented control com 3 abas:
- **Mesas** ([MesasPanel.tsx](web/src/modules/admin/pages/mesas/MesasPanel.tsx)): grid de cards com status (Livre / Pedido novo pulsando vermelho / Aguardando pagamento laranja / Paga azul). Beep + toast Radix quando chega pedido novo `type=TABLE` via socket. Click no card abre [MesaDetailDrawer](web/src/modules/admin/pages/mesas/MesaDetailDrawer.tsx) com 3 colunas drag-and-drop (`@dnd-kit`): Pendentes / Em preparo / Entregues. Botão "Receber pagamento" abre [PaymentMethodPicker](web/src/modules/admin/pages/mesas/PaymentMethodPicker.tsx) com 4 botões grandes (PIX/Dinheiro/Crédito/Débito). "Fechar sessão" fica disabled até a sessão estar paga.
- **QR Codes** ([QRCodesPanel.tsx](web/src/modules/admin/pages/mesas/QRCodesPanel.tsx)): input "Total de mesas: N" reconcilia (`PUT /admin/tables/count` → cria 1..N e remove > N, falha 422 se tem sessão aberta). Botão "Imprimir todos" baixa PDF único (`GET /admin/tables/qrcode/pdf-all`, 1 mesa por página A4). Lista por mesa com botão individual de PDF.
- **Histórico** ([HistoricoPanel.tsx](web/src/modules/admin/pages/mesas/HistoricoPanel.tsx)): sessões CLOSED filtradas por data (default = hoje). Mostra mesa, abertura, fechamento, duração, # pedidos, método de pagamento, deviceNames e total. Total da receita do período no canto. Endpoint `GET /admin/tables/sessions/history?from=&to=`.

### Pedidos — fluxo de confirmação e impressão (v2.8)

**Kanban com 4 colunas** ([OrdersPage.tsx](web/src/modules/admin/pages/OrdersPage.tsx)): `Novos` (WAITING_*) · `Em preparo` (CONFIRMED + PREPARING) · `Saiu pra entrega` (READY + DISPATCHED) · `Concluídos` (DELIVERED). Coluna "Confirmado" foi mesclada em "Em preparo" — auto-confirm dispara ambos no mesmo instante e a separação não agregava operacionalmente.

**`Store.autoConfirmOrders`** controla se pedido novo nasce em `CONFIRMED` ou em `WAITING_*`:
- **ON**: `createOrder` seta status `CONFIRMED` + `confirmedAt: now`, e dispara via `setImmediate` os mesmos side-effects que `updateOrderStatus(→CONFIRMED)`: `autoPrintOrder` + `linkOrderToCashFlow`. Vale **inclusive para PIX** (modal de ativação no front avisa o operador que não há checagem de comprovante — confira o app do banco).
- **OFF**: pedido nasce em `WAITING_PAYMENT_PROOF` (PIX) ou `WAITING_CONFIRMATION` (demais). Card de Novos mostra botão verde "Confirmar pedido" que chama `updateOrderStatus(→CONFIRMED)`. O "→" (avançar) só aparece depois de confirmar.
- **Exceção**: pedido agendado (`scheduledFor`) **nunca** auto-confirma — fica em WAITING_* até a hora.

Toggle vive no header da OrdersPage, persiste via `PATCH /admin/store/payment-settings { autoConfirmOrders }`. Ativar abre modal de aviso PIX; desativar é direto.

**Fila de impressão `PrintJob`** ([print.service.ts](api/src/modules/print/print.service.ts) + [admin/print.service.ts](api/src/modules/admin/print.service.ts)): `autoPrintOrder(orderId)` enfileira `PrintJob(orderId, status=PENDING)` em vez de imprimir direto. Feature flag `Store.features.auto_print` (Premium) gate. Idempotente — `PrintJob.orderId` é UNIQUE; segunda chamada engole `Prisma P2002` sem propagar.

**App desktop Menuziprinter** (em [.local/Menuziprinter-module-estavel-final/](.local/Menuziprinter-module-estavel-final/)) consome a fila via polling. Contrato fixo montado em `/api/print/*` **fora** de `/api/v1` para casar com o que o Electron já espera ([electron/services/poller.ts](.local/Menuziprinter-module-estavel-final/electron/services/poller.ts)):
- `POST /api/print/login { email, password }` → `{ token, restaurant }` — JWT scope=`'print'`, vale 365d.
- `GET /api/print/me` → `{ restaurant }` — valida sessão na abertura do app.
- `GET /api/print/pending` → `{ orders: [{ id, orderId, orderNumber, receipt }] }` — polling do operador.
- `POST /api/print/mark-printed { orderId }` → `{ success: true }` — após imprimir local.

Token JWT do printer tem `scope: 'print'` validado pelo `printerAuthMiddleware` próprio — não passa pelo `authMiddleware` de admin. Mesmo que vaze, atacante só vê fila de impressão (sem acesso a `/admin/*`).

Cron `print-jobs-cleanup` ([jobs/print-jobs-cleanup.job.ts](api/src/jobs/print-jobs-cleanup.job.ts)) roda 03:15 diariamente e remove `PrintJob.status='PRINTED'` com mais de 30 dias (`PRINT_JOBS_RETENTION_DAYS` env). Auditoria fica no `AuditLog` — `PrintJob` é só fila operacional.

**Config inicial do Menuziprinter** (operador da loja, 1ª vez): URL da API + email + senha do admin. Token JWT fica salvo em `electron-store` local — próximas aberturas pulam login.

### Mensagens WhatsApp (v2.9)

**Templates default** ([whatsapp-messages.service.ts](api/src/modules/admin/whatsapp-messages.service.ts)):

- **GREETING**: saudação multilinha com link do cardápio. Placeholder `{{link}}` é substituído por `https://<slug>.<PUBLIC_ROOT_DOMAIN>/` em [whatsapp.service.ts](api/src/modules/whatsapp/whatsapp.service.ts) (não passa por Cloudinary nem afeta IA — é só string).
- **ORDER_CREATED**: template rico — `{{cliente}}, {{telefone}}, {{endereco_bloco}}, {{itens}}, {{subtotal}}, {{frete}}, {{total}}, {{tipo_entrega}}, {{pagamento}}`. Helpers em [messages.service.ts](api/src/modules/whatsapp/messages.service.ts) montam cada bloco condicionalmente por `OrderType` (DELIVERY mostra endereço; PICKUP/TABLE pulam).
- **PREPARING**: enxuto, sem `{{numero}}` no default (só "🥳 Seu pedido já está em preparo!"). Custom pode usar placeholders.
- **DELIVERED**: **não dispara mais** mensagem. `renderAndEnqueueStatusMessage` removeu DELIVERED do `eventMap` ([messages.service.ts](api/src/modules/whatsapp/messages.service.ts)), e [motoboy.service.ts](api/src/modules/motoboy/motoboy.service.ts) `markDelivered` não chama mais `sendStatusUpdateMessage`. Template segue no banco caso a loja queira reativar via UI no futuro.

**Cooldown do GREETING — `Conversation.lastGreetingAt`**: 90 minutos. Quando uma mensagem inbound chega e `now - lastGreetingAt < 90min`, o bot **ignora completamente** — não envia GREETING/ABSENCE nem chama a IA. Fora da janela: marca `lastGreetingAt = now` ANTES de enviar (protege contra rajada de mensagens), envia GREETING (loja aberta) ou ABSENCE (fechada), aí chama a IA.

**Quando dispara ORDER_CREATED rico**: no opt-in inbound (`tryHandleOptIn` em [opt-in.service.ts](api/src/modules/whatsapp/opt-in.service.ts)), quando o pedido é "fresh" (`!preparedAt && status ∈ {WAITING_*, CONFIRMED}`). Pedidos já em PREPARING+ recebem o template do status atual via `renderAndEnqueueStatusMessage`.

**Sidebar admin**: item "Configurações" renomeado para "Minha Loja" ([AdminSidebar.tsx](web/src/modules/admin/components/AdminSidebar.tsx) e [SettingsPage.tsx](web/src/modules/admin/pages/SettingsPage.tsx)). Rota `/admin/configuracoes` mantida (sem migration de URL).

### Personalização visual (v2.9)

Loja pode customizar **logo + paleta de cores** do cardápio público em **Minha Loja → Personalização** ([SettingsPage.tsx](web/src/modules/admin/pages/SettingsPage.tsx) tab `personalizacao`).

**Schema**: `Store.primaryColor` e `Store.secondaryColor` são `String?` em HEX `#RRGGBB`. `NULL` = tema default (vermelho `#EF4444` / fundo sutil `#FEE2E2` definido no `:root` de [index.css](web/src/index.css)).

**Endpoint admin**: `PATCH /admin/store` (mesmo `updateStoreSchema`) — Zod valida HEX via regex `/^#[0-9a-fA-F]{6}$/`. Logo aceita URL absoluta ou caminho `/uploads/` (mesma regra de `products.schema`).

**Endpoint público**: `GET /menu` retorna `primaryColor` e `secondaryColor` no `store`. Cache `menu:<storeId>` é invalidado via `cache.del + emit.menuUpdated` em todo update da Store.

**Aplicação no cardápio**: [ThemeInjector](web/src/modules/menu/components/ThemeInjector.tsx) monta dentro de `MenuPage` e seta as CSS variables `--primary` e `--accent` em `document.documentElement.style`. Conversão HEX → HSL (formato Tailwind) é feita por `hexToHslString` em [shared/lib/theme.ts](web/src/shared/lib/theme.ts). Cleanup restaura os valores ao desmontar (importante porque admin compartilha o mesmo bundle).

**Paleta + util**: 10 presets curados em `PALETTE_PRESETS` ([shared/lib/theme.ts](web/src/shared/lib/theme.ts)). Admin escolhe por clique ou abre "Personalizar cor" pra picker nativo + input hex livre. `readableTextColor(hex)` calcula contraste WCAG para texto sobre botões custom.

**Preview ao vivo**: [MenuPreviewMock](web/src/modules/admin/components/MenuPreviewMock.tsx) é um mockup estático (header + tabs + 2 cards + CTA) que aceita logo+cores via props e reflete mudanças sem persistir. Layout 2 colunas (`lg:grid-cols-[minmax(0,1fr)_360px]`) na tab, com o preview `sticky` à direita.

### Toast e som compartilhados

[shared/lib/toast.tsx](web/src/shared/lib/toast.tsx) — wrapper sobre `@radix-ui/react-toast` + Zustand. API: `toast.success(title, desc?)`, `toast.error()`, `toast.info()`. Provider global no `App.tsx` envolve o `BrowserRouter`. Estilo: slide-in canto direito-inferior, auto-close 4s. Use em qualquer mutation de admin (em vez de `alert()` ou setState de erro).

[shared/lib/sounds.ts](web/src/shared/lib/sounds.ts) — `playBeep()` (oscilador 880Hz, 0.6s). Usado por OrdersPage e MesasPanel quando chega pedido novo via socket.

### Commit

Só fazer commit quando o usuário pedir explicitamente. Nunca usar `--no-verify`. Nunca pushar sem pedido.
