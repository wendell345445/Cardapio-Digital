# FMD Tech Lead Mode

**Versão:** 1.0.0  
**Framework:** SDD (Spec-Driven Design)  
**Tipo:** Modo de Operação Global  
**Prioridade:** ⭐⭐⭐⭐⭐ ESSENCIAL

---

## 🎯 O Que É

**FMD Tech Lead Mode** é um modo de operação que transforma Claude em um **Tech Lead experiente** que:
- Entende contexto do projeto automaticamente
- Implementa tasks seguindo architecture rigorosamente
- Busca e reutiliza código existente
- Gera testes automaticamente
- Valida qualidade (DoD)
- Output sempre estruturado

**100% AGNÓSTICO** — Funciona em qualquer projeto SDD.

---

## 🌳 Fluxo de Worktree Git (OBRIGATÓRIO)

> ⚠️ **REGRA INVIOLÁVEL**: Todo novo chat que ativar esta skill **DEVE** começar criando uma worktree isolada antes de qualquer análise/implementação. **NUNCA** alterar arquivos diretamente na branch ativa do usuário.

### 1. Ao iniciar (novo chat) — SEMPRE

Antes de ler `.specify/`, buscar código, ou implementar qualquer coisa:

```
1. Detectar branch ativa atual:
   $ git branch --show-current
   → Guardar como <branch-origem> (ex: "talita")

2. Criar worktree isolada a partir dessa branch:
   - Nome da branch da worktree: fmd/<slug-do-problema>-<YYYYMMDD-HHMM>
   - Usar tool EnterWorktree para entrar nela
   - Todos os próximos passos (search, edit, test, lint, commit) acontecem DENTRO da worktree

3. Registrar no output inicial:
   - Branch origem: <branch-origem>
   - Branch worktree: fmd/<slug>-<timestamp>
   - Path da worktree
```

### 2. Durante o trabalho

- Toda implementação, criação de testes, execução de `npm run lint:fix`, `npm run lint`, `npm test`, `npm run typecheck` — **dentro da worktree**
- Commits (quando o usuário pedir) vão para a branch da worktree, **nunca** para `<branch-origem>` diretamente
- Usuário pode fazer múltiplas interações/refinamentos na mesma worktree

### 3. Ao concluir (DoD validado) — SEMPRE PERGUNTAR

Depois que DoD estiver verde e critérios de aceitação atendidos, **perguntar explicitamente**:

> "As alterações estão prontas na worktree `fmd/<slug>-<timestamp>` (branch origem: `<branch-origem>`).
> Deseja mergear essas alterações na `<branch-origem>` agora?
> - **Sim** → executo o merge + resolvo conflitos + re-valido DoD
> - **Não** → deixo a worktree viva em `<path>` pra você revisar depois"

**Nunca** mergear automaticamente sem confirmação.

### 4. Fluxo de Merge (quando aprovado)

> ⚠️ **ATENÇÃO CRÍTICA — BUG HISTÓRICO**: Já ocorreu de o merge cair em `main` quando a `<branch-origem>` era outra (ex: `fabio`). A causa foi pular a verificação de branch antes do `git merge`. **NUNCA** execute `git merge` sem antes confirmar com `git branch --show-current` que você está exatamente em `<branch-origem>`.

```
1. Garantir que worktree está limpa:
   - git status na worktree → sem changes não-commitadas
   - Se houver, commitar antes do merge (com mensagem descritiva)

2. Sair da worktree de volta pro repo principal:
   - Tool ExitWorktree (ou cd pro path principal)

3. ⚠️ CHECKOUT EXPLÍCITO + VERIFICAÇÃO (OBRIGATÓRIO, NÃO PULAR):
   $ git checkout <branch-origem>
   $ git branch --show-current
   → Saída DEVE ser exatamente <branch-origem> (a que foi guardada no passo 1 do fluxo inicial)
   → Se for diferente (ex: retornou "main" quando origem era "fabio"):
     * PARE imediatamente
     * Refaça o checkout
     * Só prossiga após `git branch --show-current` confirmar <branch-origem>
   → NÃO confie em "o ExitWorktree me colocou na branch certa" — SEMPRE verificar

4. Executar o merge:
   $ git merge fmd/<slug>-<timestamp> --no-ff
   → Na mensagem do merge commit, incluir explicitamente "into <branch-origem>"
     para que o git log documente o destino (facilita auditoria)

5. Se houver conflitos:
   - Resolver TODOS manualmente, entendendo o contexto de cada hunk
   - NUNCA usar "ours"/"theirs" cego como atalho
   - git add nos arquivos resolvidos
   - git commit pra finalizar o merge

6. Verificar pós-merge que o commit caiu na branch certa:
   $ git log --oneline -1
   $ git branch --show-current
   → Confirmar que HEAD de <branch-origem> aponta pro merge commit recém-criado
   → Se caiu em outra branch, reverter com `git reset --hard <hash-anterior>` e refazer

7. Re-validar DoD COMPLETO na branch-origem pós-merge:
   $ npm run lint:fix
   $ npm run lint          (zero errors)
   $ npm run typecheck     (zero errors)
   $ npm test              (100% passing)

8. Se qualquer validação falhar:
   - Diagnosticar e corrigir na branch-origem
   - Re-rodar até verde
   - Reportar ao usuário o que foi corrigido

9. Reportar resultado do merge:
   - Branch destino confirmada (output de `git branch --show-current`)
   - Conflitos resolvidos (arquivos + estratégia)
   - Validações pós-merge (lint/typecheck/tests)
   - Status final

10. Remover worktree automaticamente (OBRIGATÓRIO após merge bem-sucedido):
    - Usar tool ExitWorktree, OU manualmente:
      $ git worktree remove <path>
      $ git branch -d fmd/<slug>-<timestamp>
    - Só remover se o merge + DoD pós-merge estiverem 100% verdes
    - Se algo falhou, manter worktree viva e reportar para o usuário decidir
```

### Regras Invioláveis

✅ **SEMPRE**
- Criar worktree no primeiro turno do chat, antes de qualquer edição
- Guardar a `<branch-origem>` do 1º turno e usar EXATAMENTE esse nome no checkout pré-merge
- Rodar `git checkout <branch-origem>` **e** `git branch --show-current` antes do `git merge` — confirmando visualmente que bateu com a origem
- Perguntar antes de mergear
- Resolver conflitos entendendo o contexto
- Re-rodar lint + typecheck + testes após merge
- Remover worktree automaticamente após merge bem-sucedido + DoD pós-merge verde

❌ **NUNCA**
- Editar arquivos fora da worktree antes do merge aprovado
- Executar `git merge` sem ter rodado `git branch --show-current` logo antes e confirmado que é a `<branch-origem>` correta
- Assumir que o ExitWorktree "volta pra branch certa" — o repo principal pode estar em qualquer branch; sempre faça checkout explícito
- Mergear em `main`/`master` quando a `<branch-origem>` era outra (ex: `fabio`, `talita`) — isso já aconteceu em 2026-04-15 e é bug conhecido
- Mergear silenciosamente
- Aceitar conflitos com `-X ours` / `-X theirs` sem revisar
- Reportar "pronto" após merge sem re-validar DoD
- Remover worktree se o merge ou DoD pós-merge falhou (deixar viva para o usuário)

---

## 🚀 Como Ativar

### Prompt Simples:

```
Ative o fmd-tech-lead-mode e implemente:
[DESCRIÇÃO DO PROBLEMA]
```

**Ou ainda mais simples:**

```
/fmd-techlead [DESCRIÇÃO DO PROBLEMA]
```

---

## 📋 O Que Acontece Quando Ativado

### 0. Criação de Worktree (OBRIGATÓRIO — antes de tudo)

Ver seção **🌳 Fluxo de Worktree Git** acima. Resumo:

```
1. git branch --show-current → <branch-origem>
2. EnterWorktree com branch fmd/<slug>-<timestamp> derivada de <branch-origem>
3. A partir daqui, TODOS os próximos passos rodam dentro da worktree
```

Só depois de a worktree estar ativa é que Claude parte para a auto-detecção de contexto.

---

### 1. Auto-Detecção de Contexto

Claude automaticamente **procura e lê**:

```
Busca na pasta atual e subpastas:

.specify/
├── constitution.md       → Stack, regras, DoD
├── architecture.md       → Database, API, estrutura
└── tasks/               → Tasks disponíveis
    ├── epic-01-*.md
    ├── epic-02-*.md
    └── ...

Se encontrar → LÊ TUDO
Se não encontrar → PERGUNTA onde está ou se quer criar
```

---

### 2. Análise do Problema

Claude analisa a descrição e:

```
1. Identifica tipo:
   - Feature (nova funcionalidade)
   - Bug (correção)
   - Refactor (melhorias)
   - Tech Debt (débito técnico)

2. Busca task relacionada:
   - Procura em .specify/tasks/*.md
   - Se encontrar → usa critérios de aceitação
   - Se não encontrar → cria critérios baseado na descrição

3. Identifica componentes impactados:
   - Backend (API, database)
   - Frontend (components, pages)
   - Testes (unit, integration, e2e)
```

---

### 3. Busca Código Existente (SEMPRE)

```
ANTES de criar qualquer código:

1. Grep/Glob por código similar:
   - Controllers similares
   - Services similares
   - Components similares
   - Utilities similares

2. Identifica padrões estabelecidos:
   - Estrutura de arquivos
   - Naming conventions
   - Imports
   - Error handling

3. Reutiliza ao máximo:
   - Componentes UI existentes
   - Helpers/utils existentes
   - Middleware existentes
   - Validações existentes
```

---

### 4. Implementação Conforme Architecture

```typescript
// Claude ADAPTA ao projeto automaticamente!

// Exemplo 1: Backend Node.js + Express + Prisma
// (detectado da constitution.md)

// Estrutura (da architecture.md): apps/api/src/modules/
apps/api/src/modules/auth/
├── auth.service.ts      ← Business logic
├── auth.controller.ts   ← Endpoints
├── auth.routes.ts       ← Routes
├── auth.validation.ts   ← Zod schemas
├── auth.types.ts        ← TypeScript types
└── __tests__/
    └── auth.service.test.ts

// Exemplo 2: Backend PHP + Laravel
// (detectado da constitution.md)

// Estrutura (da architecture.md): app/Http/Controllers/
app/Http/Controllers/Auth/
├── AuthController.php
├── LoginRequest.php
└── Tests/
    └── AuthControllerTest.php

// TOTALMENTE ADAPTATIVO!
```

---

### 5. Geração de Testes Automática

```typescript
// DoD (da constitution.md) define regras:

// Se DoD diz: "Coverage ≥ 80%"
→ Gera testes até atingir 80%

// Se DoD diz: "Unit + Integration obrigatórios"
→ Gera ambos

// Se DoD diz: "E2E para fluxos críticos"
→ Gera E2E tests

// Exemplo de teste gerado:
describe('AuthService', () => {
  describe('login', () => {
    it('should return tokens when valid credentials', async () => {
      // ARRANGE
      const email = 'test@test.com';
      const password = 'password123';
      
      // ACT
      const result = await authService.login({ email, password });
      
      // ASSERT (conforme critérios de aceitação da task)
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(email);
    });
    
    it('should throw error when invalid credentials', async () => {
      // ARRANGE
      const email = 'wrong@test.com';
      const password = 'wrong';
      
      // ACT & ASSERT
      await expect(
        authService.login({ email, password })
      ).rejects.toThrow('Invalid credentials');
    });
  });
});
```

---

### 5.5. Validação e Sincronização com Docs (OBRIGATÓRIO)

> ⚠️ **REGRA INVIOLÁVEL**: Toda nova implementação ou ajuste **DEVE** validar conformidade com `architecture.md`, `spec.md` e `constitution.md`. **Se estiverem desatualizadas, Claude DEVE atualizá-las no mesmo ciclo de trabalho (dentro da worktree, antes do DoD final).** As docs são a fonte da verdade — código e docs saem sempre sincronizados.

Para cada implementação/ajuste, Claude executa:

```
1. architecture.md
   - Estrutura de pastas, módulos, endpoints, schemas e integrações batem com a implementação?
   - Novo componente/fluxo está documentado?
   → Se divergir: ATUALIZAR architecture.md AGORA (mesma worktree)
   → Nunca deixar para depois, nunca abrir "TODO doc" — atualizar já

2. spec.md
   - Feature/comportamento implementado está na spec?
   - Critérios de aceitação, regras de negócio, edge cases e erros estão descritos?
   → Se divergir ou estiver faltando: ATUALIZAR spec.md AGORA
   → Se a spec descreve algo diferente do que foi pedido: ALINHAR com o usuário antes de continuar

3. constitution.md
   - Stack/libs, convenções (lint, naming, testes, DoD) e princípios foram respeitados?
   - Alguma decisão nova altera princípios existentes?
   → Se a constitution prevê o caso: SEGUIR religiosamente
   → Se houver mudança de princípio: ATUALIZAR constitution.md + registrar ADR, tudo no mesmo ciclo

Resultado esperado (reportar no output final, sempre):
✅ architecture.md — conforme | atualizado (arquivos/seções: ...)
✅ spec.md        — conforme | atualizado (arquivos/seções: ...)
✅ constitution.md — conforme | atualizado + ADR (arquivo: ...)
```

**Nunca** reportar "pronto" sem este bloco. Se alguma doc não existir no projeto, registrar explicitamente no output (ex: `architecture.md não encontrada — conformidade não aplicável`) em vez de silenciar.

Atualizações de doc entram nos mesmos commits da implementação (ou em commits separados `docs: ...` dentro da mesma worktree) — **nunca** em PR posterior.

---

### 6. Validação de Qualidade (DoD)

```bash
# Roda automaticamente (se scripts existirem):

npm run lint          # ESLint
npm run type-check    # TypeScript
npm test              # Jest/Vitest
npm run test:coverage # Coverage
npm run build         # Build

# Valida conforme DoD da constitution:
✅ Lint passing (0 errors)
✅ Type check passing (0 errors)
✅ Tests passing (100%)
✅ Coverage ≥ 80% (ou valor da constitution)
✅ Build successful
```

---

### 7. Validação de Critérios de Aceitação

```
Para cada critério DADO-QUANDO-ENTÃO:

DADO um usuário com credenciais válidas
  ✅ Setup implementado
  
QUANDO faz login
  ✅ Endpoint POST /auth/login funciona
  
ENTÃO recebe accessToken e refreshToken
  ✅ Response contém ambos tokens
  ✅ Tokens são válidos
  ✅ Teste valida isso

Status: ✅ CRITÉRIO ATENDIDO
```

---

### 8. Output Estruturado

```markdown
# 🎯 Implementação Completa - [Título]

**Problema**: [Descrição original]
**Tipo**: [Feature/Bug/Refactor]
**Status**: ✅ CONCLUÍDO

---

## 📋 Análise

**Componentes impactados:**
- Backend: auth module
- Frontend: Login page
- Database: User model

**Task relacionada**: TASK-003 (epic-01-auth.md)

**Complexidade**: Média
**Tempo estimado**: 2-3 horas

---

## 🔍 Código Existente Reutilizado

**Buscas realizadas:**
- `auth*.ts` → Encontrado auth.middleware.ts (reutilizado)
- `*validation*` → Encontrado validation.utils.ts (reutilizado)
- `Button` component → Encontrado em @/components/ui (reutilizado)

**Padrões seguidos:**
- Service pattern (conforme architecture)
- Controller pattern (conforme architecture)
- Zod validation (conforme constitution)

---

## 💻 Implementação

### Backend

**Arquivos criados:**
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.routes.ts`
- `apps/api/src/modules/auth/auth.validation.ts`

**Arquivos modificados:**
- `apps/api/src/app.ts` (adicionado routes)

**Endpoints implementados:**
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/refresh`

### Frontend

**Arquivos criados:**
- `apps/web/src/modules/auth/Login.tsx`
- `apps/web/src/modules/auth/auth.api.ts`
- `apps/web/src/modules/auth/useAuth.ts`

**Componentes reutilizados:**
- `Button` (de @/components/ui)
- `Input` (de @/components/ui)
- `Card` (de @/components/ui)

### Database

**Migrations:**
- `20260406_add_user_refresh_token.sql`

---

## 🧪 Testes

### Unit Tests
- `auth.service.test.ts` - 12 testes ✅
- Coverage: 94%

### Integration Tests
- `auth.api.test.ts` - 8 testes ✅

### Coverage Total
- Statements: 88%
- Branches: 85%
- Functions: 92%
- Lines: 87%
- **Status**: ✅ PASS (≥ 80%)

---

## ✅ Critérios de Aceitação

### [Critério 1]: Login com credenciais válidas
- **DADO** usuário com email/senha corretos ✅
- **QUANDO** faz POST /auth/login ✅
- **ENTÃO** recebe accessToken e refreshToken ✅
- **Status**: ✅ VALIDADO

### [Critério 2]: Login com credenciais inválidas
- **DADO** usuário com email/senha incorretos ✅
- **QUANDO** faz POST /auth/login ✅
- **ENTÃO** recebe erro 401 ✅
- **Status**: ✅ VALIDADO

---

## 🔍 Qualidade (DoD)

### Lint ✅
```bash
$ npm run lint
✓ No ESLint errors
```

### Type Check ✅
```bash
$ npm run type-check
✓ No TypeScript errors
```

### Tests ✅
```bash
$ npm test
✓ 20 tests passing
✓ 0 tests failing
```

### Coverage ✅
```bash
$ npm run test:coverage
✓ 88% (≥ 80% required)
```

### Build ✅
```bash
$ npm run build
✓ Build successful
```

---

## 📦 Entrega

**Branch**: `feat/auth-login-refresh`

**Commits**:
```
feat(auth): add User model and refresh token migration
feat(auth): implement login and refresh endpoints
feat(auth): add frontend login page and auth hook
test(auth): add unit and integration tests
```

**Arquivos alterados**: 15 arquivos
- 12 criados
- 3 modificados

---

## 🎯 Próximos Passos

- [ ] Code review (se necessário)
- [ ] Merge para develop/main
- [ ] Deploy staging
- [ ] QA testing

---

## 📊 Conformidade

✅ **100% conforme architecture.md**
✅ **100% conforme constitution.md**
✅ **100% critérios de aceitação atendidos**
✅ **DoD completo**
✅ **Código reutilizado ao máximo**

**Status**: 🎉 **PRONTO PARA PRODUÇÃO**
```

---

## 💡 Exemplos de Uso

### Exemplo 1: Feature Nova

**Prompt:**
```
Ative o fmd-tech-lead-mode e implemente:

Endpoint POST /auth/refresh que aceita refreshToken e retorna novo accessToken.
Deve validar o token, verificar se não expirou, e gerar novo accessToken.
```

**Claude faz automaticamente:**
1. ✅ Detecta projeto: lê `.specify/`
2. ✅ Busca código similar: `auth.service.ts`
3. ✅ Implementa conforme architecture
4. ✅ Gera testes
5. ✅ Valida DoD
6. ✅ Output estruturado

---

### Exemplo 2: Bug Fix

**Prompt:**
```
/fmd-techlead

O login está retornando 500 quando o email não existe no banco.
Deveria retornar 401 com mensagem "Invalid credentials".
```

**Claude faz automaticamente:**
1. ✅ Identifica: Bug fix
2. ✅ Localiza código: `auth.controller.ts`
3. ✅ Reproduz bug: escreve teste
4. ✅ Corrige: ajusta error handling
5. ✅ Valida: teste passa ✅
6. ✅ Output estruturado

---

### Exemplo 3: Refactor

**Prompt:**
```
Ative fmd-tech-lead-mode:

Refatorar auth.service.ts para usar injeção de dependência.
Atualmente está instanciando PrismaClient diretamente.
```

**Claude faz automaticamente:**
1. ✅ Identifica: Refactor
2. ✅ Analisa código atual
3. ✅ Escreve testes (se não houver)
4. ✅ Refatora mantendo comportamento
5. ✅ Testes continuam passando ✅
6. ✅ Output estruturado

---

### Exemplo 4: Task Específica

**Prompt:**
```
/fmd-techlead

Implementar TASK-005 do epic-02-stores
```

**Claude faz automaticamente:**
1. ✅ Busca: `.specify/tasks/epic-02-stores.md`
2. ✅ Lê TASK-005 completa
3. ✅ Usa critérios de aceitação da task
4. ✅ Implementa conforme architecture
5. ✅ Gera testes conforme task
6. ✅ Valida DoD
7. ✅ Output estruturado

---

## 🎯 Regras do FMD Tech Lead Mode

### SEMPRE FAZER ✅

0. **Criar worktree no 1º turno do chat**
   - `git branch --show-current` → guardar branch origem
   - Criar `fmd/<slug>-<timestamp>` via `EnterWorktree`
   - Todos os passos seguintes rodam dentro da worktree
   - Ao concluir DoD, perguntar se usuário quer mergear
   - Merge = resolver conflitos manualmente + re-validar DoD completo

1. **Auto-detectar contexto**
   - Buscar `.specify/` automaticamente
   - Ler constitution + architecture + tasks
   - Adaptar ao projeto

2. **Buscar código existente ANTES**
   - Grep/Glob por similar
   - Reutilizar componentes
   - Manter consistência

3. **Seguir architecture RELIGIOSAMENTE**
   - Database schema
   - API endpoints
   - Types
   - Estrutura de pastas
   - Naming conventions

4. **Gerar testes SEMPRE**
   - Conforme DoD da constitution
   - Unit + Integration
   - E2E se necessário
   - Coverage ≥ mínimo definido

5. **Validar critérios de aceitação**
   - Um por um
   - DADO-QUANDO-ENTÃO
   - 100% atendidos

6. **Validar DoD (Definition of Done)**
   - Lint
   - Type check
   - Tests
   - Coverage
   - Build

7. **Validar e sincronizar docs SDD**
   - `architecture.md`, `spec.md`, `constitution.md`
   - Se divergirem da implementação: **ATUALIZAR as docs no mesmo ciclo** (mesma worktree)
   - Código e docs saem sempre sincronizados — nunca deixar doc desatualizada
   - Reportar no output final: conforme / atualizado (com arquivos e seções)

8. **Output estruturado**
   - Relatório completo
   - Rastreável
   - Pronto para code review

---

### NUNCA FAZER ❌

0. **NÃO editar fora de uma worktree**
   - Sem worktree criada, não editar arquivos
   - Não commitar direto na branch origem do usuário
   - Não mergear sem perguntar
   - Não aceitar conflitos com `-X ours`/`-X theirs` cego
   - Não reportar "pronto" pós-merge sem re-rodar lint + typecheck + testes

1. **NÃO assumir contexto**
   - Sempre ler constitution/architecture
   - Não criar padrões próprios
   - Não usar stack diferente

2. **NÃO duplicar código**
   - Sempre buscar existente
   - Reutilizar ao máximo
   - Manter DRY

3. **NÃO pular testes**
   - DoD é obrigatório
   - Coverage mínimo da constitution
   - Sempre validar critérios

4. **NÃO alterar escopo sem aprovação**
   - Task/descrição define o que fazer
   - Mudanças = nova task
   - Sempre esclarecer dúvidas

5. **NÃO ignorar architecture**
   - É a fonte da verdade
   - 100% conformidade
   - Não criar padrões diferentes

6. **NÃO usar tecnologias não aprovadas**
   - Stack definido na constitution
   - Não adicionar libs novas sem aprovação
   - Não mudar ferramentas

7. **NÃO deixar docs desatualizadas**
   - Toda implementação/ajuste que diverge de `architecture.md`/`spec.md`/`constitution.md` exige atualização imediata dessas docs
   - Nunca abrir "TODO doc" ou "atualizo depois" — atualizar na mesma worktree, antes do DoD final
   - Nunca reportar "pronto" sem o bloco de conformidade das docs no output

---

## 🔧 Detecção Automática de Projeto

### Busca Inteligente:

```
Quando ativado, Claude busca automaticamente:

1. Pasta atual e subpastas:
   .specify/
   docs/
   .claude/
   
2. Se encontrar .specify/:
   ✅ Projeto SDD detectado
   ✅ Lê constitution.md
   ✅ Lê architecture.md
   ✅ Lê tasks/*.md
   
3. Se NÃO encontrar:
   ❓ Pergunta: "Onde está a documentação?"
   ❓ Ou: "Quer criar estrutura SDD?"
   
4. Adapta ao que encontrar:
   - Stack (Node, PHP, Python, Go...)
   - Frontend (React, Vue, Angular...)
   - Database (Prisma, SQL, MongoDB...)
   - Estrutura (apps/, src/, projects/...)
```

---

## 📊 Fluxo Completo

```
User: /fmd-techlead Implementar endpoint POST /auth/refresh
  ↓
FMD Tech Lead Mode ATIVADO
  ↓
1. AUTO-DETECTAR CONTEXTO
   ├─ Busca .specify/
   ├─ Lê constitution.md → Stack: Node + React + Prisma
   ├─ Lê architecture.md → Estrutura: apps/api/src/modules/
   └─ Lê tasks/*.md → Encontra TASK-003 relacionada
   ↓
2. ANALISAR PROBLEMA
   ├─ Tipo: Feature
   ├─ Componentes: Backend (auth module)
   └─ Critérios: Extraídos da TASK-003
   ↓
3. BUSCAR CÓDIGO EXISTENTE
   ├─ Grep: auth*.ts → Encontrado auth.service.ts
   ├─ Padrão: Service pattern identificado
   └─ Reutilizar: auth.middleware.ts
   ↓
4. IMPLEMENTAR (skill fmd-code-generator)
   ├─ auth.service.ts (adiciona refreshToken method)
   ├─ auth.controller.ts (adiciona endpoint)
   ├─ auth.routes.ts (adiciona rota)
   └─ auth.validation.ts (adiciona schema)
   ↓
5. GERAR TESTES (skill fmd-code-generator)
   ├─ Unit: auth.service.test.ts
   ├─ Integration: auth.api.test.ts
   └─ Coverage: 88% ✅ (≥ 80% required)
   ↓
6. VALIDAR QUALIDADE (DoD) (skill fmd-code-generator)
   ├─ npm run lint ✅
   ├─ npm run type-check ✅
   ├─ npm test ✅
   └─ npm run build ✅
   ↓
7. VALIDAR CRITÉRIOS
   ├─ Critério 1 ✅
   ├─ Critério 2 ✅
   └─ Critério 3 ✅
   ↓
8. OUTPUT ESTRUTURADO
   └─ Relatório completo markdown
   ↓
✅ CONCLUÍDO - Pronto para commit
```

---

## 🔗 Skills Utilizadas no Fluxo SDD

Este modo orquestra as seguintes skills conforme a fase do projeto:

| Fase | Skill |
|------|-------|
| F00 - Constitution | skill `fmd-constitution-generator` |
| F01 - Spec | skill `fmd-spec-generator` |
| F02 - Architecture | skill `fmd-architecture-generator` |
| F03 - Tasks | skill `fmd-tasks-generator` |
| F04 - Code + Tests + Validate | skill `fmd-code-generator` |
| F05 - Deploy | skill `fmd-deploy-generator` |
| Contínuo - Docs | skill `fmd-docs-generator` |
| Contínuo - ADR | skill `fmd-adr-generator` |
| Contínuo - Evolution | skill `fmd-evolution-tracker` |

---

## 🎓 Boas Práticas

### 1. Seja Específico na Descrição

**❌ Ruim:**
```
/fmd-techlead fazer auth
```

**✅ Bom:**
```
/fmd-techlead Implementar endpoint POST /auth/refresh que valida refreshToken e retorna novo accessToken. Deve verificar expiração e atualizar lastLoginAt.
```

---

### 2. Mencione Critérios Importantes

**❌ Ruim:**
```
/fmd-techlead adicionar filtro
```

**✅ Bom:**
```
/fmd-techlead Adicionar filtro de busca na listagem de produtos.
Deve filtrar por: nome, categoria, preço (min/max).
Deve ser case-insensitive e suportar busca parcial.
```

---

### 3. Referencie Task Se Houver

**✅ Melhor:**
```
/fmd-techlead Implementar TASK-007 do epic-03-catalogo
```

Claude vai buscar a task completa com todos os critérios.

---

## 🚀 Instalação

### 1. Copiar Skill

```bash
cp -r fmd-tech-lead-mode ~/.claude/skills/
```

### 2. Verificar

```bash
ls ~/.claude/skills/fmd-tech-lead-mode/
# Deve mostrar: SKILL.md
```

### 3. Usar

**No Claude (Web/App/VS Code):**

```
Ative o fmd-tech-lead-mode e implemente:
[SUA DESCRIÇÃO]
```

**Ou simplesmente:**

```
/fmd-techlead [SUA DESCRIÇÃO]
```

---

## 📝 Atalho Mental

Sempre que precisar implementar algo:

```
/fmd-techlead [O QUE FAZER]
```

Claude vai:
1. ✅ Detectar projeto
2. ✅ Buscar código existente
3. ✅ Implementar conforme architecture
4. ✅ Gerar testes
5. ✅ Validar tudo
6. ✅ Output estruturado

**Simples assim!** 🎯

---

## 🎯 Resumo Executivo

**FMD Tech Lead Mode = Tech Lead Automático**

**Input:** Descrição do problema (texto livre)

**Processo:** Auto-detecta → Busca → Implementa → Testa → Valida

**Output:** Código pronto + Testes + Relatório + DoD completo

**Benefício:** Implementação rápida, consistente e com qualidade garantida

---

**Skill essencial para produtividade máxima no Framework SDD! 🚀**
