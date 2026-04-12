# Menu Panda

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

## Deploy (Railway)

O deploy é automático após merge em `main` via GitHub Actions.
