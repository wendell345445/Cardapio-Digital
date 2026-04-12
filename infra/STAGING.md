# Staging Environment — Railway

## Configuração

O staging é configurado no Railway como um **ambiente separado** da mesma branch.

### Passo a passo (Railway Dashboard)

1. Abra o projeto no Railway
2. Clique em **"New Environment"**
3. Nome: `staging`
4. Branch: `develop`
5. Copie as variáveis de ambiente de `production` e ajuste:
   - `NODE_ENV=production` (manter)
   - `DATABASE_URL` → banco separado de staging
   - `PUBLIC_ROOT_DOMAIN=staging.menupanda.com.br` (ou o domínio que for usado em staging)
   - `API_URL=https://api.menupanda.com.br`
   - `ALLOWED_ORIGINS=https://staging.menupanda.com.br`

### Deploy manual para staging

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy da branch atual para o ambiente staging
railway up --environment staging
```

### Staging URLs

| Serviço | URL |
|---------|-----|
| API | `https://api.menupanda.com.br` |
| Web | `https://staging.menupanda.com.br` |
| Health | `https://api.menupanda.com.br/health` |

### Banco de dados separado

O staging usa um PostgreSQL separado — nunca o mesmo banco de produção.
No Railway Dashboard, crie um novo plugin PostgreSQL no ambiente `staging`.

### Fluxo de deploy

```
develop branch → push → Railway staging auto-deploy
main branch    → push → CI/CD pipeline → Railway production (via ci.yml deploy job)
```

### Rollback em staging

```bash
railway rollback --service api --environment staging
```
