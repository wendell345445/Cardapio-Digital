# ADR-0001: Motoboys e Blacklist/Whitelist como itens standalone na sidebar

- **Status:** Proposto
- **Data:** 2026-04-21
- **Decisores:** Fabio Dias (tech lead), product owner
- **Relacionado:** Epic 04 (Config Loja), Epic 08 (Admin UI Redesign), TASK-053, TASK-054, TASK-110, TASK-111

---

## Contexto

A tela `Configurações da Loja` ([web/src/modules/admin/pages/SettingsPage.tsx](../../web/src/modules/admin/pages/SettingsPage.tsx)) concentra hoje cinco abas num mesmo nível visual:

| Tab | Natureza | Uso |
|-----|----------|-----|
| Dados | Config (nome, logo, endereço, status) | Esporádico |
| Pagamentos | Config (WhatsApp, Pix, formas de pagto) | Esporádico |
| **Motoboys** | **Cadastro de usuários (CRUD)** | **Recorrente (operacional)** |
| **Blacklist/Whitelist** | **Gestão de clientes (lista + ações)** | **Recorrente (operacional)** |
| Assinatura | Billing (Stripe Customer Portal) | Esporádico |

Duas dessas abas — **Motoboys** e **Blacklist/Whitelist** — não são "configurações" no sentido de parâmetros da loja. São **entidades operacionais**:

- **Motoboys** é um CRUD completo de usuários com role `MOTOBOY` (cadastro, edição, remoção, re-senha), usado sempre que há troca/contratação de entregador.
- **Blacklist/Whitelist** é uma tela de gestão de clientes: lista todos os clientes com histórico na loja e permite classificá-los em BLACKLIST/WHITELIST para controle de formas de pagamento.

Ambas competem com telas de mesma natureza que **já** são itens standalone na sidebar: `Clientes`, `Entregas`, `Produtos`, `Categorias`, `Adicionais`.

### Sinais que motivaram a revisão

1. **Descoberta pior que a de páginas equivalentes.** Para remover um motoboy, o admin precisa navegar `Configurações → aba Motoboys` (2 cliques + ler cabeçalho). Para remover um cliente, é `Clientes` direto (1 clique). Para entidades com a mesma cardinalidade de uso, a assimetria é arbitrária.
2. **Nomenclatura já denuncia o desalinho.** `"Configurações da Loja"` no header não descreve Motoboys nem Blacklist. O usuário lê o título e precisa "desligar" o modelo mental pra encontrar o CRUD.
3. **Precedente no próprio projeto.** Epic 08 (Spec v2.0, 2026-04-07) já fez exatamente essa extração para **Bairros** (TASK-110) e **Horários** (TASK-111): eram tabs em `SettingsPage`, viraram páginas standalone com entrada na sidebar. O critério usado na época — *"são entidades, não parâmetros"* — se aplica 1:1 a Motoboys e Blacklist.
4. **Crescimento interno das abas.** A tab Motoboys já tem formulário + tabela + modal de edição + toasts. A tab Blacklist/Whitelist tem tabela + 3 ações por linha. Ambas têm volume de UI que compete com o espaço de uma página.

### Estado atual (arquitetura)

**Frontend:**

- [web/src/modules/admin/pages/SettingsPage.tsx](../../web/src/modules/admin/pages/SettingsPage.tsx):29 define `type Tab = 'dados' | 'pagamentos' | 'motoboys' | 'acesso' | 'assinatura'`
- Sub-componentes `TabMotoboys` (L621-807) e `TabAcesso` (L809-916) vivem inline no mesmo arquivo (~920 linhas totais)
- Rota única `/admin/configuracoes` com `?tab=motoboys` / `?tab=acesso` via query string
- Sidebar em [web/src/modules/admin/components/AdminSidebar.tsx](../../web/src/modules/admin/components/AdminSidebar.tsx):30 tem 11 itens — **sem** entrada para Motoboys ou Blacklist

**Backend (não muda):**

- Motoboys: `api/src/modules/admin/motoboys.*` + rotas `/admin/motoboys`
- Blacklist/Whitelist: `api/src/modules/admin/payment-access.*` + rotas `/admin/store/payment-access` e `/admin/store/clients`

**Hooks/serviços (não mudam):**

- `useMotoboys`, `useCreateMotoboy`, `useUpdateMotoboy`, `useDeleteMotoboy`
- `useStoreClients`, `useAddPaymentAccess`, `useRemovePaymentAccess`

---

## Decisão

**Extrair as abas `Motoboys` e `Blacklist/Whitelist` de `SettingsPage` e transformá-las em páginas standalone, com entradas próprias na sidebar admin.**

Concretamente:

1. Criar [web/src/modules/admin/pages/MotoboysPage.tsx](../../web/src/modules/admin/pages/MotoboysPage.tsx), movendo `TabMotoboys` + `EditMotoboyModal` + `MotoboyToastView` para lá (sem mudanças funcionais).
2. Criar [web/src/modules/admin/pages/ClientesAcessoPage.tsx](../../web/src/modules/admin/pages/ClientesAcessoPage.tsx) (nome provisório — ver Consequências), movendo `TabAcesso`.
3. Registrar rotas `/admin/motoboys` e `/admin/clientes/acesso` em [App.tsx](../../web/src/App.tsx), ambas dentro de `<AdminLayout>`.
4. Adicionar dois itens na sidebar ([AdminSidebar.tsx:30](../../web/src/modules/admin/components/AdminSidebar.tsx)):
   - `Motoboys` — ícone `Bike` (ou `Truck` se preferir consistência com `Entregas`)
   - `Blacklist/Whitelist` — ícone `ShieldCheck` ou `UserX`
5. Remover as abas `motoboys` e `acesso` do enum `Tab` e dos botões de aba em `SettingsPage`; atualizar default tab e lista `TABS`.
6. Criar redirects de compatibilidade: `/admin/configuracoes?tab=motoboys` → `/admin/motoboys`; `/admin/configuracoes?tab=acesso` → `/admin/clientes/acesso`.
7. Atualizar referências em docs internas (epic-04, epic-08) com nota "extraído em ADR-0001".

A decisão é **puramente de navegação e organização de UI** — não altera backend, schema, endpoints, nem comportamento de negócio.

---

## Alternativas consideradas

### A) Manter como tabs em Configurações (status quo)

- **Prós:** zero código novo, zero risco de regressão.
- **Contras:** mantém a assimetria de descoberta vs. `Clientes`/`Entregas`; mantém o título "Configurações" sendo enganoso; mantém `SettingsPage.tsx` com ~920 linhas misturando parâmetros e CRUDs.
- **Descartada porque:** os sinais que motivaram a revisão não se resolvem sem mexer em nada.

### B) Agrupar em um submenu "Operacional" na sidebar

- Uma entrada `Operacional` que expande em `Motoboys` + `Blacklist/Whitelist`.
- **Prós:** não polui a sidebar com 2 itens novos.
- **Contras:** nenhum outro item da sidebar atual usa submenu — introduzir o padrão só por 2 itens não paga. A Spec v2.0 explicitamente optou por sidebar flat com 9-11 itens, e Bairros/Horários seguiram esse padrão quando foram extraídos.
- **Descartada porque:** precedente de Epic 08 rejeitou submenu; consistência vence economia de espaço visual.

### C) Mover apenas Motoboys, manter Blacklist/Whitelist como tab

- **Prós:** Motoboys tem uso mais recorrente; Blacklist é mais raro.
- **Contras:** divide arbitrariamente duas abas com o mesmo problema (são entidades, não parâmetros). Ficam inconsistentes entre si.
- **Descartada porque:** o critério "é entidade operacional?" é binário e ambos passam.

### D) Mover para dentro da página `Clientes` existente (para Blacklist/Whitelist)

- Ao invés de página nova, Blacklist/Whitelist viraria uma **seção/aba dentro de `/admin/clientes`**.
- **Prós:** semanticamente coerente — "acesso do cliente" é atributo do cliente.
- **Contras:** expande o escopo de `ClientsPage`, que hoje é listagem simples; exigiria redesenho da página e decisão sobre tabs internas vs. coluna "Acesso" na tabela de clientes.
- **Parcialmente aceita:** esta alternativa está listada em **Consequências > Follow-ups** como uma evolução futura viável (pode acontecer em Epic posterior). No curto prazo, página standalone é o movimento mínimo que resolve o problema imediato.

---

## Consequências

### Positivas

- **Descoberta simétrica.** Motoboys e Blacklist ficam a 1 clique, igual a Clientes/Produtos/Entregas.
- **Nomenclatura honesta.** `Configurações` volta a significar apenas parâmetros da loja (Dados, Pagamentos, Assinatura).
- **Arquivo menor.** `SettingsPage.tsx` cai de ~1040 para ~500 linhas; duas páginas novas de ~200 linhas cada. Mais fácil de manter e revisar.
- **Precedente consolidado.** Reforça o padrão "entidade operacional = página standalone" já estabelecido em Epic 08 — futuras adições seguem sem discussão.

### Neutras / Trade-offs

- **Sidebar cresce de 11 para 13 itens.** Ainda dentro da faixa aceitável (Spec v2.0 previa até 12-15 flat items). Se passar de 15, reconsiderar agrupamento.
- **Query string `?tab=motoboys|acesso` precisa de redirect.** Existem links internos (notificações, docs de usuário) que podem apontar pra lá. Mapeei 2 usos atuais; adicionar redirects 301 no `App.tsx` cobre.

### Negativas / Riscos

- **Nome da rota Blacklist/Whitelist.** "Blacklist" no path expõe jargão técnico e gera ruído em URLs compartilhadas. Proposta `/admin/clientes/acesso` mitiga; alternativas: `/admin/controle-de-acesso`, `/admin/clientes-restritos`. **Decisão final fica para PR, não para ADR.**
- **Ícone/label da sidebar.** "Blacklist/Whitelist" é longo e bilíngue. "Controle de Acesso" ou "Acesso de Clientes" ficam mais limpos em pt-BR. Mesma observação: decidir no PR com screenshot.
- **Redirect de compatibilidade adiciona ~10 linhas em App.tsx** (já há precedente com `/admin/orders`→`/admin/pedidos` etc., então não é padrão novo).

### Follow-ups (não bloqueantes)

- **FU-1.** Avaliar se Blacklist/Whitelist evolui para ser uma seção da página `Clientes` (alternativa D) — medir uso depois de 1 sprint vivo como standalone.
- **FU-2.** Motoboys standalone abre espaço pra features de "escala/turnos" ou "histórico de entregas por motoboy" que não cabiam na aba.
- **FU-3.** Atualizar docs de suporte ao cliente (se existirem) com os novos paths.

---

## Critérios de aceitação (pra validar a execução)

- [ ] `/admin/motoboys` acessível pela sidebar, com a mesma UI de hoje (form + tabela + modal + toasts)
- [ ] `/admin/clientes/acesso` (ou path final) acessível pela sidebar, com a mesma UI de hoje
- [ ] `/admin/configuracoes` **não** exibe mais as abas Motoboys nem Blacklist/Whitelist
- [ ] `/admin/configuracoes?tab=motoboys` redireciona 301 para `/admin/motoboys`
- [ ] `/admin/configuracoes?tab=acesso` redireciona 301 para o novo path
- [ ] Sidebar exibe os 2 itens novos com ícones distintos e labels finais aprovados
- [ ] `npm run lint`, `npm run typecheck`, `npm test` passam sem novos errors
- [ ] Nenhuma mudança em API/backend/schema Prisma

---

## Referências

- Spec v2.0 Migration (2026-04-07) — precedente de Bairros/Horários como páginas standalone
- [tasks/epic-04-config-loja.md](../../tasks/epic-04-config-loja.md) — TASK-053 (Motoboys), TASK-054 (Blacklist)
- [tasks/epic-08-admin-ui-redesign.md](../../tasks/epic-08-admin-ui-redesign.md) — TASK-110 (Bairros standalone), TASK-111 (Horários standalone)
- [web/src/modules/admin/pages/SettingsPage.tsx](../../web/src/modules/admin/pages/SettingsPage.tsx) — estado atual
- [web/src/modules/admin/components/AdminSidebar.tsx](../../web/src/modules/admin/components/AdminSidebar.tsx) — sidebar a estender
