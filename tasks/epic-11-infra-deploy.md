# Epic 11 — Infraestrutura de Deploy + Subdomain Routing

**Sprint:** 17  
**Total:** ~17 pts  
**Referência:** `.specify/changelog/v2.3-migration.md`  
**Breaking Change:** Sim — migração path-based → subdomain-based

---

## Contexto

O sistema foi desenvolvido com roteamento path-based (`/:slug`), mas a spec e o pitch usam subdomain-based (`slug.domínio.com`). Esta epic alinha código e spec, adiciona suporte a domínio próprio por loja, e entrega a infra de produção.

---

## Tasks

### TASK-121 — Schema: campo `customDomain` no model Store

**Pts:** 1  
**Fase:** 1 — Schema + Dev Setup  
**Prioridade:** Alta (bloqueante para TASK-122)

**O que fazer:**
1. Adicionar campo `customDomain String? @unique` no model `Store` em `api/prisma/schema.prisma`
2. Adicionar `@@index([customDomain])`
3. Criar migration: `npx prisma migrate dev --name add_store_custom_domain`

**Critério de aceite:**
- Migration aplicada sem erro
- Campo aparece no Prisma Client
- Campo é `null` por padrão (não quebra lojas existentes)

---

### TASK-122 — Backend: Tenant Middleware (subdomain + customDomain)

**Pts:** 3  
**Fase:** 2 — Backend  
**Prioridade:** Alta  
**Dependência:** TASK-121

**O que fazer:**
1. Reescrever `api/src/shared/middleware/tenant.middleware.ts`
2. Lógica de resolução (usa `process.env.PUBLIC_ROOT_DOMAIN` + fallbacks `cardapio.test`/`localhost`):
   - Hostname termina com `.${PUBLIC_ROOT_DOMAIN}` ou `.cardapio.test` → slug = primeiro segmento
   - Hostname é domínio raiz (`${PUBLIC_ROOT_DOMAIN}`, `cardapio.test`, `localhost`) → sem tenant (owner/admin global)
   - Qualquer outro hostname → busca por `customDomain` no banco
3. Remover `/:slug` de todas as rotas Express que usam o slug como param
4. Substituir `req.params.slug` por `req.store.slug` em todos os controllers

```typescript
// api/src/shared/middleware/tenant.middleware.ts
const ROOT_DOMAINS = Array.from(new Set([
  process.env.PUBLIC_ROOT_DOMAIN || 'supercardapio.com.br',
  'cardapio.test',
  'localhost',
]))

function resolveSlugFromHostname(hostname: string): string | null {
  if (ROOT_DOMAINS.includes(hostname)) return null
  const matchedRoot = ROOT_DOMAINS.find((root) => hostname.endsWith(`.${root}`))
  if (matchedRoot) return hostname.slice(0, -(matchedRoot.length + 1)).split('.')[0]
  return null // não é subdomínio → tenta customDomain
}
```

**Critério de aceite:**
- `pizzariadonamaria.cardapio.test` → resolve loja correta
- `supercardapio.test` → resolve loja com `customDomain = 'supercardapio.test'`
- Hostname desconhecido → 404 `{ error: 'Loja não encontrada' }`
- Nenhum controller usa `req.params.slug`

---

### TASK-117 — Backend: endpoint `GET /health`

**Pts:** 1  
**Fase:** 2 — Backend  
**Prioridade:** Alta (bloqueante para CI health check)

**O que fazer:**
1. Verificar se `GET /health` existe; criar se não existir
2. Retornar `{ status: 'ok', timestamp: new Date().toISOString() }`
3. Não deve passar pelo `tenantMiddleware`

**Critério de aceite:**
- `curl https://api.cardapio.test:3001/health` retorna 200

---

### TASK-123 — Frontend: hook `useStoreSlug`

**Pts:** 2  
**Fase:** 3 — Frontend  
**Prioridade:** Alta  
**Dependência:** TASK-122

**O que fazer:**
1. Criar `web/src/hooks/useStoreSlug.ts`
2. Lógica (usa `import.meta.env.VITE_PUBLIC_ROOT_DOMAIN` + fallbacks dev):
   - Hostname raiz (qualquer item em `ROOT_DOMAINS`) → retorna `null` (área owner/admin global)
   - Subdomínio de qualquer `ROOT_DOMAINS[i]` → retorna slug (ex: `"pizzariadonamaria"`)
   - Qualquer outro hostname → retorna `'__custom_domain__'` (backend resolve pelo customDomain)

```typescript
// web/src/hooks/useStoreSlug.ts
const ROOT_DOMAINS = Array.from(new Set([
  import.meta.env.VITE_PUBLIC_ROOT_DOMAIN || 'supercardapio.com.br',
  'cardapio.test',
  'localhost',
]))

export function useStoreSlug(): string | null {
  const hostname = window.location.hostname

  if (ROOT_DOMAINS.includes(hostname)) {
    return null
  }

  const matchedRoot = ROOT_DOMAINS.find((root) => hostname.endsWith(`.${root}`))
  if (matchedRoot) return hostname.slice(0, -(matchedRoot.length + 1)).split('.')[0]

  return '__custom_domain__'
}
```

**Critério de aceite:**
- Hook testado com os 3 casos (raiz, subdomínio, customDomain)
- Substituir todos os `useParams().slug` no frontend pelo hook

---

### TASK-124 — Frontend: React Router sem `/:slug`

**Pts:** 3  
**Fase:** 3 — Frontend  
**Prioridade:** Alta  
**Dependência:** TASK-123

**O que fazer:**
1. Reescrever `web/src/App.tsx` removendo `/:slug` de todas as rotas
2. Substituir `useParams().slug` por `useStoreSlug()` em todos os componentes
3. Atualizar links internos (ex: `navigate(\`/${slug}/admin\`)` → `navigate('/admin')`)

**Antes:**
```tsx
<Route path="/:slug" element={<MenuPage />} />
<Route path="/:slug/pedido/:token" element={<OrderTrackingPage />} />
<Route path="/:slug/admin/*" element={<AdminLayout />} />
```

**Depois:**
```tsx
<Route path="/" element={<MenuPage />} />
<Route path="/pedido/:token" element={<OrderTrackingPage />} />
<Route path="/admin/*" element={<AdminLayout />} />
```

**Critério de aceite:**
- Nenhum `/:slug` nos paths do React Router
- Navegar para `/admin` em `pizzariadonamaria.cardapio.test` carrega admin da loja correta
- Nenhum `useParams().slug` nos componentes

---

### TASK-125 — Dev: vite.config.ts HTTPS + docs de setup local

**Pts:** 1  
**Fase:** 1 — Dev Setup  
**Prioridade:** Alta

**O que fazer:**
1. Atualizar `web/vite.config.ts`:
   - Adicionar `host: true`
   - Adicionar `https` com cert mkcert de `infra/certs/`
2. Criar `infra/certs/.gitignore` com `*` (certs não vão para o repo)
3. Criar `infra/certs/README.md` com instrução de geração
4. Documentar no `README.md` do projeto o passo a passo do setup local com subdomínio

**Conteúdo do `infra/certs/README.md`:**
```
# Certificados Locais (mkcert)

Estes arquivos são gerados localmente e NÃO estão no repositório.

## Como gerar

brew install mkcert
mkcert -install
cd infra/certs
mkcert "*.cardapio.test" cardapio.test supercardapio.test

## /etc/hosts necessário

127.0.0.1 cardapio.test
127.0.0.1 demo.cardapio.test
127.0.0.1 <slug>.cardapio.test   (um por loja de teste)
127.0.0.1 supercardapio.test     (domínio próprio de teste)
```

**Critério de aceite:**
- `https://demo.cardapio.test:5173` carrega sem aviso de SSL
- Certs não aparecem no `git status`

---

### TASK-127 — DB: Squash das migrations em schema unificado (bloqueante p/ primeiro deploy)

**Pts:** 2
**Fase:** 4 — Infra Prod
**Prioridade:** Crítica — **deve ser feita antes** da TASK-116
**Contexto:** Descoberto durante testes locais do Epic 13 (Hotfix v2.5.4, 2026-04-10). O banco de desenvolvimento foi inicializado via `prisma db push` em algum momento, então a tabela `_prisma_migrations` está **vazia** mesmo havendo 6 arquivos de migration em `api/prisma/migrations/`. Rodar `prisma migrate deploy` no primeiro deploy em prod vai tentar aplicar as 6 migrations contra um banco vazio — funciona no Railway porque lá o banco é 100% limpo, mas:
  - (a) o time local vai continuar inconsistente (drift entre migrations e state real),
  - (b) qualquer `db push` futuro em dev quebra o histórico do prod,
  - (c) as migrations atuais referenciam estruturas de várias versões (v2.0 a v2.5) acumuladas sem lógica — se precisarmos rollback, ficamos órfãos.

**O que fazer:**

1. **Resetar o estado local do Prisma sem perder dados dev** (opcional, só se quiser alinhar dev):
   ```bash
   # Faz baseline das migrations existentes como "já aplicadas"
   cd api
   for m in $(ls prisma/migrations | grep -v migration_lock); do
     npx prisma migrate resolve --applied "$m"
   done
   ```

2. **Gerar uma migration unificada (`0000_init`)** a partir do schema atual:
   ```bash
   # Cria um banco shadow, gera a migration diff contra schema vazio
   rm -rf prisma/migrations/*
   npx prisma migrate dev --name init --create-only
   # Revisar o SQL gerado (extensões, enums, constraints, índices)
   ```

   Alternativa mais conservadora: manter as migrations antigas como histórico e criar **apenas** uma nova "baseline" com `--create-only` marcada como aplicada:
   ```bash
   npx prisma migrate diff \
     --from-empty \
     --to-schema-datamodel prisma/schema.prisma \
     --script > prisma/migrations/0000_baseline/migration.sql
   ```

3. **Validar contra staging** antes de qualquer ação em prod:
   - Restaurar um dump do banco de dev em um Postgres shadow
   - Rodar `npx prisma migrate deploy` contra o shadow
   - Comparar `\dt` e `\d+ "Store"` antes/depois

4. **Atualizar o CI** (TASK-116) para rodar `prisma migrate deploy` com a migration unificada.

5. **Documentar** no README do backend como rodar migrations em dev (sempre `migrate dev`, nunca `db push` em áreas compartilhadas).

**Por que isto importa:**
- Evita o erro "relation already exists" no primeiro deploy em Railway se o banco já tiver dados de teste
- Dá uma base limpa pra CI/CD e futuras migrations (v2.6+) sem carregar histórico acumulado
- Se algum dia precisar recriar o banco do zero (staging novo, disaster recovery), basta rodar a migration inicial + as subsequentes — sem precisar conhecer o histórico legado

**Critério de aceite:**
- `npx prisma migrate status` retorna `Database schema is up to date` em dev
- `_prisma_migrations` table existe e tem ao menos a baseline aplicada
- CI em staging aplica a migration sem erros em um banco vazio
- README/architecture.md atualizado com a nova política ("dev usa `migrate dev`, nunca `db push`")

---

### TASK-116 — CI/CD: job de deploy no GitHub Actions

**Pts:** 2  
**Fase:** 4 — Infra Prod  
**Prioridade:** Alta
**Dependência:** TASK-127 (schema unificado antes do deploy)

**O que fazer:**
1. Adicionar job `deploy` no `.github/workflows/deploy.yml`
2. Executar após job de build/test passar
3. Incluir `prisma migrate deploy` e health check pós-deploy
4. Rollback automático se health check falhar (Railway: `railway rollback`)

```yaml
deploy:
  needs: [build]
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v4
    - name: Deploy to Railway
      run: railway up
      env:
        RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
    - name: Run migrations
      run: railway run npx prisma migrate deploy
    - name: Health check
      run: |
        sleep 15
        curl --fail ${{ secrets.API_URL }}/health || \
          (railway rollback && echo "Deploy failed" && exit 1)
```

**Critério de aceite:**
- Push para `main` dispara deploy automático
- Health check valida após deploy
- Rollback automático se falhar

---

### TASK-118 — Infra: `.env.production.example`

**Pts:** 1  
**Fase:** 4 — Infra Prod  
**Prioridade:** Alta

**O que fazer:**
1. Criar `.env.production.example` na raiz com todas as vars obrigatórias documentadas
2. Incluir comentário explicando cada variável

```env
# Banco de dados
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis
REDIS_URL=redis://host:6379

# Auth
JWT_SECRET=min-32-chars-random-string

# App
NODE_ENV=production
PORT=3001
PUBLIC_ROOT_DOMAIN=supercardapio.com.br
API_URL=https://${PUBLIC_ROOT_DOMAIN}

# Frontend (Vite)
VITE_PUBLIC_ROOT_DOMAIN=supercardapio.com.br
VITE_API_URL=https://${PUBLIC_ROOT_DOMAIN}

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Cloudflare (para cert wildcard via Caddy)
CF_API_TOKEN=...
```

**Critério de aceite:**
- Arquivo existe e está no repositório
- Nenhuma var secreta real (apenas placeholders)

---

### TASK-119 — Infra: Dockerfiles + docker-compose.prod.yml + Caddyfile

**Pts:** 2  
**Fase:** 4 — Infra Prod  
**Prioridade:** Média

**O que fazer:**
1. Criar `api/Dockerfile` (multi-stage: builder + runner)
2. Criar `web/Dockerfile` (multi-stage: builder + nginx)
3. Criar `infra/docker-compose.prod.yml`
4. Criar `infra/Caddyfile` com wildcard `*.${PUBLIC_ROOT_DOMAIN}` e DNS challenge

**Critério de aceite:**
- `docker compose -f infra/docker-compose.prod.yml up --build` sobe API e web
- API responde em `:3001/health`
- Web serve o frontend buildado

---

### TASK-120 — Staging: Railway `develop` branch

**Pts:** 1  
**Fase:** 4 — Infra Prod  
**Prioridade:** Média

**O que fazer:**
1. Configurar Railway para fazer deploy automático da branch `develop` em ambiente de staging
2. Staging URL: `staging-api.${PUBLIC_ROOT_DOMAIN}`
3. Documentar como fazer deploy manual para staging

**Critério de aceite:**
- Push para `develop` dispara deploy em staging
- Staging tem banco separado de produção

---

### TASK-126 — Pós-migração: QR Codes + WhatsApp + OAuth

**Pts:** 1  
**Fase:** 5 — Pós-migração  
**Prioridade:** Baixa (executar após go-live)

**O que fazer:**
1. Regenerar QR Codes de todas as lojas (URL agora sem `/:slug`)
2. Atualizar templates WhatsApp GREETING e ABSENCE com nova URL
3. Reconfigurar OAuth callback URLs no Google Console e Facebook Developers

**Critério de aceite:**
- QR Codes apontam para `https://{slug}.${PUBLIC_ROOT_DOMAIN}` (sem path)
- Templates WhatsApp com URL correta
- OAuth Google e Facebook funcionando no subdomínio

---

## Dependências entre Tasks

```
TASK-121 ──→ TASK-122 ──→ TASK-123 ──→ TASK-124
TASK-125 (independente — pode ser feita em paralelo)
TASK-117 (independente)
TASK-116 ──→ TASK-120
TASK-118 (independente)
TASK-119 (independente)
TASK-126 (após go-live)
```

---

## Resumo

| Task | Descrição | Pts | Fase |
|---|---|---|---|
| TASK-121 | Schema — `customDomain` + migration | 1 | 1 — DB |
| TASK-125 | vite.config.ts HTTPS + docs dev local | 1 | 1 — Dev |
| TASK-117 | `GET /health` endpoint | 1 | 2 — Backend |
| TASK-122 | Tenant middleware (subdomain + customDomain) | 3 | 2 — Backend |
| TASK-123 | Hook `useStoreSlug` | 2 | 3 — Frontend |
| TASK-124 | React Router sem `/:slug` | 3 | 3 — Frontend |
| **TASK-127** | **DB: Squash migrations em schema unificado** (bloqueante) | **2** | **4 — Infra** |
| TASK-116 | CI/CD deploy job + health check | 2 | 4 — Infra |
| TASK-118 | `.env.production.example` | 1 | 4 — Infra |
| TASK-119 | Dockerfiles + compose.prod + Caddyfile | 2 | 4 — Infra |
| TASK-120 | Staging Railway `develop` | 1 | 4 — Infra |
| TASK-126 | QR Codes + WhatsApp + OAuth pós-migração | 1 | 5 — Pós |
| **Total** | | **~19 pts** | |
