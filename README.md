# Menu Panda - Com Talita

Plataforma SaaS white-label de cardápio digital e gestão de pedidos.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Node.js 20 + Express + TypeScript + Prisma
- **Database:** PostgreSQL 15
- **Cache/Queue:** Redis 7
- **Realtime:** Socket.io
- **Deploy:** Railway

## Pré-requisitos

- Node.js 20+
- Docker + Docker Compose
- npm 10+

## Setup Local

### 1. Clone e instale dependências

```bash
git clone <repo-url>
cd /project-folder
npm install
```

### 2. Configure variáveis de ambiente (api, app e root no ambiente local|prod)

```bash
cp .env.example .env
# Edite .env com suas credenciais em cada projeto (root, app e api)
```

### 3. Suba a infra (Postgres, Redis, dnsmasq, Caddy) e os serviços (api + web)

```bash
npm run dev:all   # infra + api + web num comando só (use esse no dia a dia)
```

Comandos granulares (se precisar):

```bash
npm run dev:up    # só infra: auto-detecta LAN_IP e sobe os containers
npm run dev       # só api + web (assume infra já no ar)
npm run dev:down  # derruba os containers
```

> `dev:up` roda `infra/scripts/sync-lan-ip.sh` antes do `docker compose up -d`: detecta o IP atual da rede (`en0`/`en1`), reescreve `LAN_IP` no `.env` se mudou, e recria o container `dnsmasq` pra aplicar o novo IP. Isso resolve o caso típico de trocar de Wi-Fi (casa ↔ trabalho) e `cardapio.test` parar de responder.

### 4. Rode as migrations e seed

```bash
cd api
npx prisma migrate dev
npx prisma db seed
cd ..
```

### 5. Inicie o projeto

```bash
npm run dev
```

- API: http://localhost:3001
- Web: http://localhost:5173
- Health check: http://localhost:3001/health

## Estrutura

```
menu-panda/
├── api/                    # Backend Express
│   ├── prisma/             # Schema, migrations, seed
│   └── src/
│       ├── modules/        # Módulos de domínio
│       └── shared/         # Infra compartilhada
├── web/                    # Frontend React
│   └── src/
│       ├── modules/        # Módulos de funcionalidade
│       └── shared/         # Componentes e hooks compartilhados
└── docker-compose.yml
```

## Credenciais de Teste (após seed)

| Role | Email | Senha |
|---|---|---|
| Owner | uendell@menupanda.com | owner123 |
| Admin (Loja A) | admin@pizzariadonamaria.com | admin123 |
| Admin (Loja B) | admin@burguertop.com | admin123 |
| Admin (Loja C) | admin@sushiexpress.com | admin123 |

## Scripts

```bash
npm run dev          # Inicia api + web em paralelo
npm run build        # Build de produção (api + web)
npm run lint         # ESLint em ambos
npm run typecheck    # TypeScript check em ambos
npm run test         # Testes em ambos
npm run format       # Prettier em todo o projeto
```

## Upload de imagens

- **Produção:** Cloudinary. Preencha `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` (ou `CLOUDINARY_URL`) em `api/.env`.
- **Dev:** se as variáveis estiverem vazias ou com placeholder (`your-cloud-name`, etc.), o backend cai automaticamente pra armazenamento local em `api/uploads/` (gitignored), servido em `/uploads/...`. Útil pra rodar local sem credenciais externas.

A detecção é lazy (na primeira chamada). Prod com Cloudinary real não depende do fallback.

## Cupom e desconto

- **Cupom clássico** (aplicado no checkout via código): gerenciado em `/admin/cupons`.
- **Promoção por produto** (preço absoluto com datas de início/fim, auto-aplicado no cardápio): botão **Adicionar desconto** em cada produto na tela `/admin/produtos`. O cardápio público mostra o preço riscado com o novo preço ao lado; o backend recalcula o preço no `createOrder` consultando a promo vigente — cliente nunca dita o preço.

Promoção por produto usa o mesmo model `Coupon` (com `productId + promoPrice`), código auto-gerado (`PROMO_xxx`) e não aceito no checkout manual. Não se aplica a produtos com variations.

## Pedidos em mesa (TableSession + QR Code)

Cada mesa física tem um **QR Code** com URL `https://{slug}.{rootDomain}/mesa/:n`. Cliente escaneia, informa o nome (ou pula com "Sou convidado"), e o sistema abre uma `TableSession` única por mesa. Vários celulares na mesma mesa entram na mesma sessão (segundo scan retorna o mesmo token), e cada pedido é etiquetado com `deviceName` pra cozinha saber quem pediu.

**Painel admin** em `/admin/mesas` (sidebar item "Mesas"):

- **Mesas**: cards em mosaico — Livre / Pedido novo (vermelho pulsando) / Aguardando pagamento / Paga. Beep + toast no admin quando chega pedido novo. Click no card abre o drawer da mesa com 3 colunas drag-and-drop (Pendentes / Em preparo / Entregues), botão "Receber pagamento" (PIX/Dinheiro/Crédito/Débito) e "Fechar sessão" (só libera depois de pago).
- **QR Codes**: input "Total de mesas: N" reconcilia com o banco (cria 1..N e remove > N — só remove livres). Botão "Imprimir todos" baixa PDF único com 1 mesa por página A4.
- **Histórico**: sessões fechadas com filtro por data, totais e métodos de pagamento. Default = hoje.

Toggle **Atendimento em mesa** em `/admin/entregas > Status` (`Store.allowTable`). Quando desligado, o item "Mesas" some da sidebar e o QR de mesa retorna 422.

Pagamento de mesa entra no `CashFlow` aberto via `linkOrderToCashFlow` (mesmo helper que pedidos online usam ao virar `CONFIRMED`). Métodos de pagamento de mesa: `PIX`, `CASH`, `CREDIT`, `DEBIT` (limpos, sem `_ON_DELIVERY`).

## Re-autenticação de ações sensíveis

Criar/editar/duplicar produto e excluir produto/categoria/adicional exigem re-digitar a senha via modal antes de executar. Endpoint: `POST /api/v1/auth/reauth`.

## Deploy (Railway)

O deploy é automático após merge em `main` via GitHub Actions.
