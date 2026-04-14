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

### 3. Suba o banco e Redis

```bash
docker-compose up -d
```

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

## Re-autenticação de ações sensíveis

Criar/editar/duplicar produto e excluir produto/categoria/adicional exigem re-digitar a senha via modal antes de executar. Endpoint: `POST /api/v1/auth/reauth`.

## Deploy (Railway)

O deploy é automático após merge em `main` via GitHub Actions.
