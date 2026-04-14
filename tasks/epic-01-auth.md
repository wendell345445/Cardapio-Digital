# Epic 01 — Autenticação e Autorização

> JWT + OAuth 2.0 (Google/Facebook) + RBAC. Fundação para todos os módulos protegidos.

**Total estimado:** 21 story points

---

## TASK-010: Auth — JWT + Login Email/Senha

**Epic:** 01-Auth  
**Story:** Base auth  
**Estimativa:** 5 pts  
**Dependências:** TASK-002 (Prisma)

### Subtasks
- [x] `npm install jsonwebtoken passport passport-local bcryptjs`
- [x] Criar middleware `authenticateJWT` (valida access token)
- [x] Criar middleware `requireRole(...roles)` (RBAC)
- [x] Implementar `POST /api/v1/auth/login` → email+senha → JWT access (15min) + refresh (7d)
- [x] Implementar `POST /api/v1/auth/refresh` → refresh token → novo access token
- [x] Implementar `POST /api/v1/auth/logout` → invalida refresh token (delete do banco)
- [x] Implementar `POST /api/v1/auth/reauth` → confirma senha (ações sensíveis)
- [x] bcrypt salt rounds 12 para OWNER, ADMIN, MOTOBOY
- [x] Armazenar refresh token na tabela `RefreshToken`
- [x] Validação Zod em todos os endpoints

### Critérios de Done
- [x] Login retorna access + refresh token
- [x] Access token expira em 15min (testado)
- [x] Refresh token renova access token
- [x] Logout invalida refresh no banco
- [x] `reauth` bloqueia acesso sem senha correta
- [x] Unit: `validateCredentials`, `generateTokens`
- [x] Integration: POST /auth/login, /auth/refresh, /auth/logout

### Arquivos Criados
- `api/src/modules/auth/auth.schema.ts`
- `api/src/modules/auth/auth.service.ts`
- `api/src/modules/auth/auth.controller.ts`
- `api/src/modules/auth/auth.routes.ts`
- `api/src/modules/auth/__tests__/auth.service.test.ts`
- `api/src/modules/auth/__tests__/auth.routes.test.ts`
- `api/src/router.ts` (atualizado)
- `api/src/app.ts` (atualizado — passport.initialize)

---

## TASK-011: Auth — OAuth Google e Facebook

**Epic:** 01-Auth  
**Story:** Social login  
**Estimativa:** 5 pts  
**Dependências:** TASK-010

### Subtasks
- [x] `npm install passport-google-oauth20 passport-facebook`
- [x] Configurar Passport strategies (Google + Facebook)
- [x] Implementar `POST /api/v1/auth/google` → code OAuth → JWT
- [x] Implementar `POST /api/v1/auth/facebook` → code OAuth → JWT
- [x] Lógica: se email já existe no banco → vincular `googleId`/`facebookId`; se não → criar user
- [x] Nunca armazenar OAuth tokens — apenas `provider_id` e `provider`
- [x] Fluxo de callback OAuth com redirect para frontend

### Critérios de Done
- [x] Login com Google redireciona corretamente e retorna JWT
- [x] Login com Facebook redireciona corretamente e retorna JWT
- [x] Usuário existente com mesmo email é vinculado (não duplicado)
- [x] `googleId`/`facebookId` únicos por tabela
- [x] Integration: ambos os fluxos OAuth mockados

### Arquivos Criados
- `api/src/modules/auth/passport.config.ts`

---

## TASK-012: Auth — Middleware Multi-tenant

**Epic:** 01-Auth  
**Story:** Isolamento  
**Estimativa:** 3 pts  
**Dependências:** TASK-010

### Subtasks
- [x] Middleware `extractStoreId`: extrai `storeId` do JWT do admin/motoboy
- [x] Middleware `requireStore`: bloqueia requisição sem `storeId` válido
- [x] Todas as rotas `/api/v1/admin/*` exigem `storeId` no JWT
- [x] Todas as queries de admin têm `WHERE storeId = req.storeId` obrigatório
- [x] Owner passa `storeId` como parâmetro de rota (não no JWT)
- [x] Teste de isolamento: admin da Loja A não pode acessar dados da Loja B

### Critérios de Done
- [x] Requisição sem `storeId` retorna 403
- [x] Isolamento multi-tenant confirmado via testes de integração
- [x] Teste de cross-tenant retorna 403 ou 404 (nunca 200 com dados de outra loja)

### Arquivos Atualizados
- `api/src/shared/middleware/auth.middleware.ts` (extractStoreId, requireStore adicionados)

---

## TASK-013: Auth — Magic Link do Cliente

**Epic:** 01-Auth  
**Story:** Acesso cliente  
**Estimativa:** 3 pts  
**Dependências:** TASK-010

### Subtasks
- [x] Gerar token UUID + JWT (24h) após criação do pedido
- [x] Implementar `GET /api/v1/auth/client-token/:token` → valida e retorna dados do pedido
- [x] Link enviado via WhatsApp: `/{slug}/pedido/{uuid-token}`
- [x] Frontend: ao abrir link, busca dados sem necessidade de login
- [x] Token expira em 24h (sem renovação)
- [x] Cliente sem token não acessa detalhes do pedido

### Critérios de Done
- [x] Link gerado após criação do pedido
- [x] Link abre tela de acompanhamento sem login
- [x] Token expirado retorna 401

### Arquivos Atualizados
- `api/src/modules/auth/auth.service.ts` (generateClientToken, verifyClientToken)
- `api/src/modules/auth/auth.controller.ts` (clientTokenController)
- `api/src/modules/auth/auth.routes.ts` (GET /client-token/:token)

---

## TASK-014: Auth — Painel Motoboy (Login + RBAC)

**Epic:** 01-Auth  
**Story:** US-009B  
**Estimativa:** 5 pts  
**Dependências:** TASK-011, TASK-012

### Subtasks
- [x] Token de motoboy: access 8h + refresh 7d (sem refresh automático durante turno)
- [x] Middleware `requireMotoboy`: valida role `MOTOBOY` + storeId
- [x] Rota login: `/{slug}/motoboy` → formulário email + senha
- [x] Suporte a OAuth (Google/Facebook) vinculado ao email cadastrado pelo Admin
- [x] Motoboy acessa apenas `/{slug}/motoboy/*` — bloqueado em qualquer outra rota
- [x] Ação "marcar como entregue" registrada em AuditLog

### Critérios de Done
- [x] Motoboy loga com email+senha ou OAuth
- [x] JWT com role `MOTOBOY` gerado
- [x] Motoboy bloqueado em rotas de admin
- [x] Motoboy de Loja A não acessa pedidos de Loja B
- [x] Unit: validação de role
- [x] Integration: login motoboy, acesso bloqueado a rotas admin

### Arquivos Criados/Atualizados
- `api/src/shared/middleware/auth.middleware.ts` (requireMotoboy adicionado)
- `api/src/modules/auth/auth.service.ts` (generateMotoboyTokens, 8h access)
- `web/src/modules/auth/services/auth.service.ts`
- `web/src/modules/auth/hooks/useLogin.ts`
- `web/src/modules/auth/hooks/useOAuthCallback.ts`
- `web/src/modules/auth/components/LoginForm.tsx`
- `web/src/modules/auth/pages/LoginPage.tsx`
- `web/src/modules/auth/pages/MotoboyLoginPage.tsx`
- `web/src/modules/auth/pages/OAuthCallbackPage.tsx`
