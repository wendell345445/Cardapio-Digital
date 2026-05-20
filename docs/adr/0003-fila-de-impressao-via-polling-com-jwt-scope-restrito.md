# ADR-0003 — Fila de impressão via polling HTTP + JWT scope restrito

**Status:** Aceito
**Data:** 2026-05-20

## Contexto

Pedidos confirmados precisam imprimir automaticamente na térmica da cozinha. O cliente (lojista) instala um app desktop **Menuziprinter** (Electron) no PC da cozinha que faz a impressão local via `webContents.print()` — o backend (Railway) nunca toca em hardware.

Duas perguntas-chave para a comunicação backend ↔ app:

1. **Como o app desktop descobre que há pedidos novos a imprimir?**
2. **Como autenticar o app desktop sem expor todo o `/api/admin/*` se o token vazar?**

O contexto adicional é que o **app Menuziprinter já existe** em `.local/Menuziprinter-module-estavel-final/` com contrato fixo: ele consome `POST /api/print/login`, `GET /api/print/me`, `GET /api/print/pending`, `POST /api/print/mark-printed` — modificar o Electron exigiria republicar `.exe` e reinstalar em todas as cozinhas. Preferimos backend acomodar esse contrato.

## Decisão

### 1. Fila persistente `PrintJob` + polling HTTP

Quando pedido vira `CONFIRMED`, `autoPrintOrder` enfileira `PrintJob(orderId, status=PENDING)` no Postgres. O Menuziprinter faz polling em `GET /api/print/pending` a cada N segundos (configurável no app), imprime localmente e marca `POST /api/print/mark-printed { orderId }`.

`PrintJob.orderId` é `UNIQUE` — segunda chamada de `autoPrintOrder` para o mesmo pedido vira no-op (Prisma `P2002` engolido). Isso evita duplicidade quando `autoConfirmOrders=true` + advance manual disparam em sequência.

Cron diário (03:15) remove `PrintJob.PRINTED > 30 dias`. Auditoria do pedido fica no `AuditLog` — `PrintJob` é fila operacional, não histórico.

### 2. JWT com `scope: 'print'` isolado do auth admin

`POST /api/print/login` aceita email/senha do admin da loja e retorna JWT com payload `{ userId, storeId, scope: 'print' }` e expiração de 365d. Middleware próprio `printerAuthMiddleware` (em `api/src/modules/print/print.controller.ts`) **só aceita tokens com `scope === 'print'`** — tokens admin/owner são rejeitados nas rotas `/api/print/*`, e o `authMiddleware` do admin rejeita tokens com scope `'print'` em `/api/admin/*`.

Rotas montadas em `/api/print/*` **fora** de `/api/v1/` (em `api/src/app.ts`) para casar com o contrato fixo do Electron.

## Alternativas

### Para a comunicação (decisão 1)

- **Socket.io event `print:order`** — backend emitiria via WS quando pedido vira CONFIRMED; Menuziprinter conectado ouve e imprime. **Rejeitado**: se o PC da cozinha estiver offline no momento (Wi-Fi caiu, reboot, app fechado), o evento se perde. O dono da loja não percebe até o cliente reclamar que pedido sumiu.
- **Webhook do backend para o PC** — backend faz POST direto pro IP local da cozinha. **Rejeitado**: o PC está atrás de NAT/firewall residencial, não tem IP público estável, e abrir porta exposta seria pior em segurança do que polling.
- **Cliente puxa diretamente de `/admin/orders?status=CONFIRMED`** — reutilizar endpoint existente. **Rejeitado**: vazaria mais informação do que o necessário pro printer (status histórico, motoboy, audit fields), e exigiria filtrar "já imprimi este orderId?" no cliente. Fila no DB centraliza isso.

### Para a auth (decisão 2)

- **Reusar JWT admin sem distinção de scope** — login do printer chamaria `loginWithPassword` direto. **Rejeitado**: se o `.exe` for descompilado e o token extraído do `electron-store`, atacante tem acesso a `/admin/orders`, `/admin/products` etc — pode cancelar pedidos, ver financeiro, deletar coisas. O scope restrito limita a `GET /api/print/pending` e `POST /api/print/mark-printed`.
- **Token estático configurado manualmente** — admin gera um "Token de impressora" em `/admin/config`, copia e cola no Menuziprinter. **Considerado**, mas: UX pior (operador precisa entrar no painel pra gerar token antes de configurar o app), e não simplifica auth (ainda precisa de middleware próprio). Email/senha do admin já é o que o lojista lembra.
- **OAuth device flow** — overkill pra single-tenant onde o operador da loja já tem credenciais admin.

## Consequências

**Positivas:**
- Robusto a quedas de rede: PrintJobs PENDING acumulam no banco; quando o PC volta, próximo poll imprime tudo em lote.
- Auditoria simples: `SELECT * FROM PrintJob WHERE status='PENDING'` mostra fila atual; `printedAt` dá histórico.
- Isolation de blast radius: token vazado não compromete `/admin/*` nem `/owner/*`.
- **Zero alteração no Menuziprinter**: o app Electron já em produção (em outras lojas) usa exatamente esse contrato — basta editar `electron/config.ts:apiUrl` e rebuild.

**Negativas:**
- Latência de impressão = `pollingSeconds` (default 5s) em vez de instantâneo. Aceitável pra cozinha — produção do pedido leva minutos.
- Polling gera tráfego mesmo sem pedidos. Mitigado: query indexada (`@@index([storeId, status])`), payload pequeno, polling rate ajustável.
- JWT com 365d expiry — se vazar, fica válido por 1 ano. Mitigado: troca de senha do usuário admin invalida o token (revalidação na próxima chamada).
- Tabela `PrintJob` cresce indefinidamente sem o cron — daí o cleanup de 30 dias é obrigatório.

## Critérios de aceitação

- [x] `POST /api/print/login` retorna JWT scope=`'print'`; tokens admin não funcionam aqui (403).
- [x] Tokens scope=`'print'` não passam pelo `authMiddleware` admin (403 em `/api/v1/admin/*`).
- [x] `PrintJob.orderId` é UNIQUE; segunda chamada de `autoPrintOrder` é no-op.
- [x] `GET /api/print/pending` só lista jobs da loja do token (tenant isolation).
- [x] Cron `print-jobs-cleanup` registrado em `index.ts` e respeita `DISABLE_CRON_JOBS=true`.

## Referências

- Implementação: `api/src/modules/print/` (login, controller, service, routes, schema)
- App desktop: `.local/Menuziprinter-module-estavel-final/` (não versionado neste repo)
- Cron de limpeza: `api/src/jobs/print-jobs-cleanup.job.ts`
- Changelog: `.specify/changelog/v2.8-migration.md` (Parte 2)
