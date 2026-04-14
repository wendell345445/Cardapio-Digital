# Epic 08 — Admin UI Redesign

**Spec:** v2.0.0  
**Migration Guide:** `.specify/changelog/v2.0-migration.md`  
**Referências visuais:** `.local/pessoal/assets/*.png` (13 imagens)  
**Sprint:** 15+  
**Total estimado:** 89 story points · ~5 sprints  
**Status:** `[x]` Concluído

> **Objetivo:** Redesenhar o admin panel e a loja pública para replicar fielmente os designs de referência do cliente. Implementar sidebar com todos os 9 itens de navegação, páginas standalone para Bairros e Horários, e redesign completo da loja pública.

---

## Dependências do Epic

- TASK-002 (Prisma schema) ✅
- TASK-010 (Auth JWT) ✅
- TASK-040 (Categorias CRUD) ✅
- TASK-041 (Produtos CRUD) ✅
- TASK-050 (Config loja) ✅
- TASK-080 (Kanban pedidos) ✅
- TASK-091 (Delivery / Bairros backend) ✅

---

## TASK-100: Design Tokens — Cor Primária Vermelha

**Epic:** 08-Admin-UI-Redesign  
**Story:** UI/UX Spec v2.0 — Seção 5.1  
**Estimativa:** 2 story points  
**Dependências:** Nenhuma (infra CSS)

### Descrição
Configurar CSS variables e Tailwind para usar vermelho `#EF4444` como cor primária do sistema (admin + loja). Atualmente usa `hsl(var(--primary))` sem valor definido para vermelho.

### Subtasks
- [x] Editar `web/src/index.css` — definir `--primary` como vermelho: `hsl(0 84% 60%)` (equivalente a `#EF4444`)
- [x] Editar `web/tailwind.config.js` — adicionar variantes `sidebar` no `colors`
- [x] Verificar que shadcn Button variant `default` fica vermelho
- [x] Verificar que shadcn Badge, Toggle ficam com primário vermelho
- [x] Snapshot visual: tela de login com botão vermelho correto

### Critérios de Aceitação
- [x] `bg-primary` renderiza `#EF4444` (vermelho)
- [x] `text-primary` renderiza vermelho
- [x] Sidebar: `bg-red-50 border-l-red-500` disponíveis
- [x] Regressão: nenhum componente existente quebrado visualmente

### Arquivos Modificados
- `web/src/index.css`
- `web/tailwind.config.js`

### Tempo Estimado
2-3 horas

---

## TASK-101: AdminLayout + AdminSidebar

**Epic:** 08-Admin-UI-Redesign  
**Story:** UI/UX Spec v2.0 — Seção 5.1 e 5.2  
**Estimativa:** 8 story points  
**Dependências:** TASK-100

### Descrição
Criar `AdminLayout` (wrapper de todas as páginas admin) e `AdminSidebar` com os 9 itens de navegação conforme design de referência (`dashboard-001.png`).

A sidebar deve ter:
- **Header:** logo da loja + nome + subtítulo "Painel do restaurante"
- **Navegação:** 9 itens com ícones Lucide (ver tabela abaixo)
- **Footer:** avatar do admin + botão "Ver cardápio público" (vermelho)
- **Item ativo:** fundo `red-50`, texto `red-500`, borda esquerda `border-l-4 border-red-500`
- **Width:** 240px fixo, `h-screen`, sticky/fixed

| # | Label | Rota | Ícone |
|---|---|---|---|
| 1 | Dashboard | `/admin/dashboard` | `LayoutDashboard` |
| 2 | Bairros | `/admin/bairros` | `MapPin` |
| 3 | Pedidos | `/admin/pedidos` | `ShoppingBag` |
| 4 | Produtos | `/admin/produtos` | `Package` |
| 5 | Categorias | `/admin/categorias` | `Tag` |
| 6 | Adicionais | `/admin/adicionais` | `PlusCircle` |
| 7 | QR Code | `/admin/qr-code` | `QrCode` |
| 8 | Horários | `/admin/horarios` | `Clock` |
| 9 | Configurações | `/admin/configuracoes` | `Settings` |

### Subtasks
- [x] Criar `web/src/modules/admin/components/AdminSidebar.tsx`
  - Props: nenhuma (lê store do useAuthStore + useQuery store info)
  - Renderiza logo da loja (ou placeholder) + nome
  - NavLink para cada item (9 itens) com `NavLink` do React Router (`isActive` para estilo ativo)
  - Footer: avatar inicial do admin + botão "Ver cardápio público" → `/{slug}` em nova aba
- [x] Criar `web/src/modules/admin/components/AdminLayout.tsx`
  - Layout: `flex h-screen overflow-hidden`
  - `<AdminSidebar />` + `<main className="flex-1 overflow-y-auto bg-gray-50">`
  - Wrapping children no `<main>`
- [x] Criar `web/src/modules/admin/components/AdminGuard.tsx`
  - Redireciona para `/login` se não autenticado ou role !== ADMIN

### Critérios de Aceitação
- [x] Sidebar visível em todas as páginas admin
- [x] Item ativo highlighted com borda vermelha e fundo `red-50`
- [x] Navegar entre itens não quebra o layout
- [x] Logo da loja carrega do storeInfo (ou placeholder hamburger)
- [x] "Ver cardápio público" abre `/{slug}` em nova aba
- [x] Mobile: sidebar oculta por padrão (não necessário responsivo completo nesta task)

### Arquivos Criados
- `web/src/modules/admin/components/AdminSidebar.tsx`
- `web/src/modules/admin/components/AdminLayout.tsx`
- `web/src/modules/admin/components/AdminGuard.tsx`

### Tempo Estimado
6-8 horas

---

## TASK-102: StoreStatusToggle na Sidebar

**Epic:** 08-Admin-UI-Redesign  
**Story:** UI/UX Spec v2.0 — Seção 5.1 / US-003B (abertura manual)  
**Estimativa:** 3 story points  
**Dependências:** TASK-101

### Descrição
Adicionar toggle "Aberto/Fechado" no header da sidebar, conforme `dashboard-001.png`. O toggle chama o endpoint existente de abertura manual da loja.

### Subtasks
- [x] Criar `web/src/modules/admin/components/StoreStatusToggle.tsx`
  - Lê `store.manualOpen` via `useQuery`
  - Toggle com label "Aberto" (verde) / "Fechado" (cinza)
  - `useMutation` → `PATCH /api/admin/settings` com `{ manualOpen: boolean }`
  - Feedback optimistic update
- [x] Integrar dentro de `AdminSidebar.tsx` no header, abaixo do nome da loja

### Critérios de Aceitação
- [x] Toggle visível no header da sidebar
- [x] Estado inicial reflete `store.manualOpen` do banco
- [x] Clicar alterna estado + chama API
- [x] Feedback visual imediato (optimistic)
- [x] Toast de sucesso/erro

### Arquivos Criados
- `web/src/modules/admin/components/StoreStatusToggle.tsx`

### Arquivos Modificados
- `web/src/modules/admin/components/AdminSidebar.tsx`

### Tempo Estimado
3-4 horas

---

## TASK-103: Badge de Pedidos Novos na Sidebar

**Epic:** 08-Admin-UI-Redesign  
**Story:** UI/UX Spec v2.0 — Seção 5.2  
**Estimativa:** 2 story points  
**Dependências:** TASK-101

### Descrição
Exibir badge numérico no item "Pedidos" da sidebar com a contagem de pedidos nos status PENDING + WAITING_PAYMENT_PROOF + WAITING_CONFIRMATION. Conforme `dashboard-001.png` (badge "29").

### Subtasks
- [x] No `AdminSidebar.tsx`, fazer `useQuery` de contagem de pedidos novos
  - Usar endpoint existente: `GET /api/admin/orders?status=PENDING,WAITING_PAYMENT_PROOF,WAITING_CONFIRMATION`
  - Extrair `meta.total` da resposta
- [x] Renderizar badge `<span>` vermelho ao lado do label "Pedidos" quando count > 0
- [x] Poll a cada 30s (ou WebSocket quando disponível)
- [x] Badge some quando count = 0

### Critérios de Aceitação
- [x] Badge numérico aparece ao lado de "Pedidos"
- [x] Valor atualiza a cada 30s
- [x] Badge não aparece quando não há pedidos novos
- [x] Badge mostra máximo "99+" quando count > 99

### Arquivos Modificados
- `web/src/modules/admin/components/AdminSidebar.tsx`

### Tempo Estimado
2-3 horas

---

## TASK-104: Rotas PT + AdminLayout em todas as páginas admin

**Epic:** 08-Admin-UI-Redesign  
**Story:** UI/UX Spec v2.0 — Seção 5.2  
**Estimativa:** 5 story points  
**Dependências:** TASK-101

### Descrição
Atualizar `App.tsx` para:
1. Renomear rotas para português (`/admin/produtos`, `/admin/pedidos`, etc.)
2. Adicionar redirects de compatibilidade das rotas antigas
3. Envolver todas as páginas admin em `<AdminLayout>`
4. Adicionar rota `/admin/dashboard` (AdminDashboardPage - stub temporário)
5. Redirecionar login ADMIN para `/admin/dashboard`

### Subtasks
- [x] Editar `web/src/App.tsx`:
  - Adicionar `<AdminLayout>` wrapping todas as rotas `/admin/*`
  - Renomear: `products` → `produtos`, `categories` → `categorias`, `orders` → `pedidos`, `settings` → `configuracoes`, `tables` → `qr-code`
  - Adicionar redirects: `<Route path="/admin/products" element={<Navigate to="/admin/produtos" replace />} />`
  - Adicionar rotas novas: `/admin/dashboard`, `/admin/bairros`, `/admin/horarios`, `/admin/adicionais`
  - Criar stub pages para as rotas novas (componente simples "Em breve")
- [x] Editar `DashboardRedirect`: ADMIN → `/admin/dashboard`
- [x] Verificar que links internos existentes nas páginas admin apontam para novas rotas

### Critérios de Aceitação
- [x] `/admin/produtos` funciona (com sidebar)
- [x] `/admin/products` redireciona para `/admin/produtos`
- [x] Todas as rotas admin têm sidebar visível
- [x] Login de ADMIN redireciona para `/admin/dashboard`
- [x] Nenhuma rota quebra (404)

### Arquivos Modificados
- `web/src/App.tsx`

### Tempo Estimado
3-4 horas

---

## TASK-105: AdminDashboardPage — KPIs + Gráfico + Resumo Operacional

**Epic:** 08-Admin-UI-Redesign  
**Story:** UI/UX Spec v2.0 — Seção 5.3  
**Estimativa:** 13 story points  
**Dependências:** TASK-104

### Descrição
Criar `AdminDashboardPage` completo conforme `dashboard-001.png`, `dashboard-002.png`, `dashboard-003.png`, `dashboard-004.png`.

Seções obrigatórias (em ordem de scroll):
1. **Hero** — título + status da loja + ações rápidas (Ver pedidos / Abrir cardápio)
2. **KPI cards (4)** — Pedidos monitorados, Receita acumulada, Ticket médio, Produtos em destaque
3. **Gráfico semanal** — barras duplas últimos 7 dias (pedidos + receita). Usar `recharts`
4. **Resumo operacional** — fila ativa, última hora, saúde %, caixas em produção, pedidos válidos, concluídos %, prontos %, cancelamentos %
5. **Ranking de produtos** — top 4 com contagem e receita (reutilizar dados de TASK-093/094)
6. **Status cards (4)** — Pendentes, Confirmados, Em preparo, Prontos (coloridos)
7. **Últimos pedidos** — últimos 5 + botão "Ver todos os pedidos"

### Subtasks
- [x] Criar `web/src/modules/admin/pages/AdminDashboardPage.tsx`
- [x] Criar `web/src/modules/admin/hooks/useAdminDashboard.ts`
  - `useQuery` para analytics: `GET /api/admin/analytics?period=7d`
  - `useQuery` para pedidos recentes: `GET /api/admin/orders?limit=5`
  - `useQuery` para ranking: `GET /api/admin/analytics/products?limit=4`
- [x] Seção 1: hero card com gradiente branco + título + ações rápidas
- [x] Seção 2: 4 KPI cards com ícones e valores
- [x] Seção 3: gráfico recharts `BarChart` com 2 barras por dia
  - `npm install recharts` se não instalado
- [x] Seção 4: resumo operacional com métricas calculadas
- [x] Seção 5: ranking de produtos (lista numerada com imagem + nome + contagem + receita)
- [x] Seção 6: 4 status cards coloridos (amarelo/azul/laranja/verde)
- [x] Seção 7: lista de últimos pedidos + link "Ver todos"

### Critérios de Aceitação
- [x] Página renderiza sem erro com dados reais da API
- [x] Gráfico mostra 7 barras (últimos 7 dias)
- [x] KPIs mostram valores corretos do dia atual
- [x] Ranking mostra os produtos mais vendidos
- [x] Status cards contam pedidos no status correto
- [x] "Ver todos os pedidos" → `/admin/pedidos`

### Arquivos Criados
- `web/src/modules/admin/pages/AdminDashboardPage.tsx`
- `web/src/modules/admin/hooks/useAdminDashboard.ts`

### Tempo Estimado
8-10 horas

---

## TASK-106: Redesign PedidosPage — Kanban + Filtros

**Epic:** 08-Admin-UI-Redesign  
**Story:** UI/UX Spec v2.0 — Seção 5.4  
**Estimativa:** 8 story points  
**Dependências:** TASK-104

### Descrição
Redesenhar `OrdersPage.tsx` para replicar `pedidos-001.png`. Manter toda lógica existente, atualizar apenas UI.

Layout alvo:
- **Barra superior:** tabs filtro (Todos / Delivery / Mesas / Retirada) + busca + filtro data + "+ Criar pedido"
- **Banner "Impressão automática"** — azul claro com ícone e toggle
- **Toggle "Impressão de vendas"** — verde quando ativo
- **Colunas Kanban** (4): Novos + toggle automático / Em preparo / Prontos/saída / Concluídos (com total R$)
- Estado vazio: ícone SVG + "Nenhum pedido nesta etapa"

### Subtasks
- [x] Atualizar `web/src/modules/admin/pages/OrdersPage.tsx`
  - Adicionar tabs de filtro: Todos / Delivery / Mesas / Retirada (filtro por `orderType`)
  - Adicionar input de busca por nome do cliente ou código
  - Adicionar seletor de data (hoje por padrão)
  - Atualizar COLUMN_CONFIG: `PENDING` → "Novos" / `CONFIRMED+PREPARING` → "Em preparo" / `READY+DISPATCHED` → "Prontos/saída" / `DELIVERED+CANCELLED` → "Concluídos"
  - Header de coluna: label + contagem de cards + total R$ (para Concluídos)
  - Estado vazio por coluna com ícone e mensagem
  - Banner "Impressão automática" (UI only, sem funcionalidade)
  - Botão "+ Criar pedido" (modal stub)

### Critérios de Aceitação
- [x] 4 colunas Kanban com labels corretos
- [x] Filtro por tipo de pedido funciona
- [x] Busca por nome/código funciona (client-side)
- [x] Contagem de cards por coluna correta
- [x] Total R$ na coluna Concluídos correto
- [x] Estado vazio visível quando coluna está vazia
- [x] Funcionalidade existente (trocar status, abrir detalhe) mantida

### Arquivos Modificados
- `web/src/modules/admin/pages/OrdersPage.tsx`

### Tempo Estimado
5-7 horas

---

## TASK-107: Redesign ProdutosPage — Category Pills + Ordenação

**Epic:** 08-Admin-UI-Redesign  
**Story:** UI/UX Spec v2.0 — Seção 5.5  
**Estimativa:** 5 story points  
**Dependências:** TASK-104

### Descrição
Redesenhar `ProductsPage.tsx` para replicar `produtos-001.png`.

Layout alvo:
- Barra de busca global no topo
- Pills de categoria (Todos + cada categoria com contagem)
- Botão "Ordenar categorias" no topo direito
- Por seção de categoria: header com nome + toggle "Disponível" + "+ Novo produto" + "Copiar produto" + "Ordenar produtos"
- Cada produto: thumbnail + nome + preço + badge desconto + toggle disponível + Editar / Duplicar / Adicionais
- Botão "+ Nova categoria" no topo direito

### Subtasks
- [x] Atualizar `web/src/modules/admin/pages/ProductsPage.tsx`
  - Adicionar barra de busca (filtra produtos por nome, client-side)
  - Pills de categoria clicáveis (scroll horizontal no mobile)
  - Filtrar produtos pelo pill ativo
  - Header por seção de categoria com toggle de disponibilidade da categoria
  - Card de produto: thumbnail 48px + nome + preço + toggle + ações (Editar / Duplicar / Adicionais)
  - Botão "+ Nova categoria" → modal ou link para `/admin/categorias`
  - Botão "+ Novo produto" por categoria → `/admin/produtos/new?categoryId=X`

### Critérios de Aceitação
- [x] Pills filtram produtos por categoria
- [x] "Todos" mostra todos os produtos agrupados por categoria
- [x] Busca filtra por nome em tempo real
- [x] Toggle disponível de produto funciona (chama API)
- [x] Ações Editar / Duplicar funcionais
- [x] "Adicionais" → link para `/admin/adicionais?productId=X`

### Arquivos Modificados
- `web/src/modules/admin/pages/ProductsPage.tsx`

### Tempo Estimado
4-5 horas

---

## TASK-108: Redesign CategoriasPage — Formulário Inline

**Epic:** 08-Admin-UI-Redesign  
**Story:** UI/UX Spec v2.0 — Seção 5.6  
**Estimativa:** 3 story points  
**Dependências:** TASK-104

### Descrição
Redesenhar `CategoriesPage.tsx` para replicar `categorias-001.png`.

Layout alvo:
- **Card "Nova categoria"** no topo — formulário inline com campos Nome + Descrição + botão "Criar categoria" (vermelho)
- **Total de categorias** no canto superior direito
- **Lista de categorias** — cada item: nome + descrição + badge "X produto(s)" + Editar + Excluir

### Subtasks
- [x] Atualizar `web/src/modules/admin/pages/CategoriesPage.tsx`
  - Substituir modal por formulário inline no topo da página
  - Card branco com padding, título "Nova categoria", subtítulo descritivo
  - Campos: nome (required) + descrição (optional) lado a lado
  - Botão "Criar categoria" full width vermelho
  - Lista abaixo: card por categoria com nome bold + descrição + badge contagem + ações

### Critérios de Aceitação
- [x] Formulário inline cria categoria sem modal
- [x] Lista atualiza após criação
- [x] Badge mostra contagem real de produtos por categoria
- [x] Excluir exibe confirmação antes de deletar
- [x] Editar abre inline edit ou modal simples

### Arquivos Modificados
- `web/src/modules/admin/pages/CategoriesPage.tsx`

### Tempo Estimado
3-4 horas

---

## TASK-109: AdicionaisPage — Nova Página com Grupos e Tabs

**Epic:** 08-Admin-UI-Redesign  
**Story:** UI/UX Spec v2.0 — Seção 5.7  
**Estimativa:** 8 story points  
**Dependências:** TASK-104

### Descrição
Criar `AdicionaisPage.tsx` conforme `adicionais-001.png`. Atualmente não existe página de adicionais — eles são gerenciados dentro do `ProductFormPage`. Esta task cria uma gestão centralizada de grupos de adicionais.

Layout alvo:
- Barra de busca no topo
- Botão "+ Novo grupo" no topo direito
- Tabs horizontais: uma aba por grupo
- Por grupo: header com nome + toggle disponível + "+ Novo item" + "Copiar item" + menu (⋮)
- Cada item: thumbnail + nome + preço + toggle disponível + Editar

### Backend (verificar se existe):
- `GET /api/admin/additionals` — listar grupos com items
- `POST /api/admin/additionals` — criar grupo
- `POST /api/admin/additionals/:id/items` — criar item
- `PATCH /api/admin/additionals/:id` — editar grupo
- `PATCH /api/admin/additionals/items/:id` — editar item

Se não existir, criar endpoints simples no `additionals.routes.ts`.

### Subtasks
- [x] Verificar se endpoints de adicionais centralizado existem no backend
  - Se não existem: criar `api/src/modules/admin/additionals.routes.ts` com CRUD básico de grupos/items
- [x] Criar `web/src/modules/admin/services/additionals.service.ts`
- [x] Criar `web/src/modules/admin/hooks/useAdditionals.ts`
- [x] Criar `web/src/modules/admin/pages/AdicionaisPage.tsx`
  - Tabs dinâmicas por grupo (reutilizar `Tabs` do shadcn/ui)
  - Card por item com thumbnail + preço + toggle + editar
  - Modal para criar/editar grupo
  - Modal para criar/editar item dentro do grupo

### Critérios de Aceitação
- [x] Página lista todos os grupos de adicionais
- [x] Tabs permitem navegar entre grupos
- [x] Criar novo grupo funciona
- [x] Criar/editar item dentro de grupo funciona
- [x] Toggle disponível de item chama API
- [x] Multi-tenant: só mostra adicionais do storeId do admin logado

### Arquivos Criados
- `web/src/modules/admin/pages/AdicionaisPage.tsx`
- `web/src/modules/admin/services/additionals.service.ts`
- `web/src/modules/admin/hooks/useAdditionals.ts`
- (condicional) `api/src/modules/admin/additionals.routes.ts`

### Tempo Estimado
6-8 horas

---

## TASK-110: BairrosPage — Página Standalone

**Epic:** 08-Admin-UI-Redesign  
**Story:** US-010 (nova) — Spec v2.0  
**Estimativa:** 5 story points  
**Dependências:** TASK-104

### Descrição
Criar `BairrosPage.tsx` como página standalone, extraindo a funcionalidade de gestão de bairros que existe em `DeliveryPage.tsx`.

### Subtasks
- [x] Criar `web/src/modules/admin/pages/BairrosPage.tsx`
  - Título "Bairros de Entrega"
  - Formulário inline para adicionar novo bairro: nome + taxa (R$) + botão "Adicionar"
  - Lista de bairros: nome + taxa + toggle ativo + excluir
  - Reutilizar `web/src/modules/admin/services/delivery.service.ts` (já existe)
  - Reutilizar `web/src/modules/admin/hooks/useDelivery.ts` (já existe)
- [x] Em `DeliveryPage.tsx`: remover seção de bairros (ou manter com link para `/admin/bairros`)

### Critérios de Aceitação
- [x] Página acessível em `/admin/bairros` com sidebar
- [x] CRUD de bairros funcional
- [x] Multi-tenant: storeId isolado
- [x] Toggle ativo/inativo funciona

### Arquivos Criados
- `web/src/modules/admin/pages/BairrosPage.tsx`

### Arquivos Modificados
- `web/src/modules/admin/pages/DeliveryPage.tsx` (remoção da seção)

### Tempo Estimado
3-4 horas

---

## TASK-111: HorariosPage — Página Standalone

**Epic:** 08-Admin-UI-Redesign  
**Story:** US-011 (nova) — Spec v2.0  
**Estimativa:** 5 story points  
**Dependências:** TASK-104

### Descrição
Criar `HorariosPage.tsx` como página standalone, extraindo a funcionalidade de horários de `SettingsPage.tsx`.

### Subtasks
- [x] Criar `web/src/modules/admin/pages/HorariosPage.tsx`
  - Título "Horários de Funcionamento"
  - Grade: 7 dias da semana (Seg → Dom)
  - Por dia: toggle "Fechado" + campos hora abertura + hora fechamento
  - Botão "Salvar horários"
  - Reutilizar hook/service de settings existente
- [x] Em `SettingsPage.tsx`: remover seção de horários (ou manter com link para `/admin/horarios`)

### Critérios de Aceitação
- [x] Página acessível em `/admin/horarios` com sidebar
- [x] Grade de 7 dias com campos de hora
- [x] Toggle "Fechado" desabilita campos do dia
- [x] Salvar persiste no backend
- [x] Dados carregam do banco ao abrir a página

### Arquivos Criados
- `web/src/modules/admin/pages/HorariosPage.tsx`

### Arquivos Modificados
- `web/src/modules/admin/pages/SettingsPage.tsx`

### Tempo Estimado
3-4 horas

---

## TASK-112: QRCodePage — Renomear TablesPage + UI Update

**Epic:** 08-Admin-UI-Redesign  
**Story:** UI/UX Spec v2.0 — Seção 5.2  
**Estimativa:** 2 story points  
**Dependências:** TASK-104

### Descrição
Renomear `TablesPage.tsx` para `QRCodePage.tsx`, atualizar rota para `/admin/qr-code`, e ajustar título e header da página para ser consistente com a sidebar.

### Subtasks
- [x] Criar `web/src/modules/admin/pages/QRCodePage.tsx` (copiar de TablesPage + renomear)
- [x] Atualizar `App.tsx`: `/admin/qr-code` → `QRCodePage`; `/admin/tables` → redirect
- [x] Atualizar título da página para "QR Code das Mesas"
- [x] Manter toda a funcionalidade existente

### Critérios de Aceitação
- [x] `/admin/qr-code` funciona com sidebar
- [x] `/admin/tables` redireciona para `/admin/qr-code`
- [x] Funcionalidade de geração de QR Code mantida

### Arquivos Criados
- `web/src/modules/admin/pages/QRCodePage.tsx`

### Arquivos Modificados
- `web/src/App.tsx`

### Tempo Estimado
1-2 horas

---

## TASK-113: Redesign MenuPage (Loja Pública) — Store Header + Grid

**Epic:** 08-Admin-UI-Redesign  
**Story:** UI/UX Spec v2.0 — Seção 5.8  
**Estimativa:** 8 story points  
**Dependências:** Nenhuma (módulo independente)

### Descrição
Redesenhar `MenuPage.tsx` para replicar `loja-catalogo-001.png` e `loja-catalogo-002.png`.

Layout alvo:
- **Background header:** gradiente marrom/laranja escuro (ocupa ~200px de altura)
- **Store card:** card branco flutuante com logo + nome + badge "Aberto agora" (verde) / "Fechado" (cinza) + telefone + endereço + "Recebimento pedidos" + "Ver horários" (collapse)
- **Barra de busca:** "Buscar pratos, combos e bebidas" com ícone lupa
- **Pills de categoria:** scroll horizontal, pill ativo em marrom/escuro
- **Seção por categoria:** label "SEÇÃO" em maiúsculo + nome + descrição
- **Grid de produtos:** 3 colunas desktop / 2 tablet / 1 mobile
- **Card de produto:** imagem quadrada + nome + descrição curta + preço + botão "+" verde
- **Carrinho flutuante:** botão verde no canto inferior direito "Carrinho (N)"

### Subtasks
- [x] Atualizar `web/src/modules/menu/pages/MenuPage.tsx`
  - Header com gradiente: `bg-gradient-to-b from-amber-900 to-amber-700`
  - Store card: card branco com `shadow-lg rounded-xl` flutuando sobre o gradiente (`-mt-16 mx-4`)
  - Badge status: verde "Aberto agora" / cinza "Fechado" baseado em `store.manualOpen` + horários
  - Busca: input full-width com ícone
  - Pills: `overflow-x-auto flex gap-2 py-2` com pill ativo estilizado
  - Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
  - Reutilizar `ProductCard.tsx` (atualizado na próxima task)
  - Botão carrinho flutuante verde: `fixed bottom-6 right-6`
- [x] Atualizar `web/src/modules/menu/components/ProductCard.tsx`
  - Layout: imagem quadrada top + conteúdo bottom
  - Botão "+" circular verde no canto inferior direito do card

### Critérios de Aceitação
- [x] Header com gradiente marrom renderizado
- [x] Store card flutuante com dados reais da loja
- [x] Badge de status correto (aberto/fechado)
- [x] Grid 3 colunas no desktop
- [x] Pills filtram produtos por categoria
- [x] Busca filtra produtos em tempo real
- [x] Carrinho flutuante mostra contagem
- [x] Mobile: 1 coluna, layout responsivo

### Arquivos Modificados
- `web/src/modules/menu/pages/MenuPage.tsx`
- `web/src/modules/menu/components/ProductCard.tsx`

### Tempo Estimado
6-8 horas

---

## TASK-114: ItemPage — Página Dedicada de Produto (substituir ProductModal)

**Epic:** 08-Admin-UI-Redesign  
**Story:** UI/UX Spec v2.0 — Seção 5.9  
**Estimativa:** 8 story points  
**Dependências:** TASK-113

### Descrição
Criar `ItemPage.tsx` como página dedicada de produto, substituindo o modal `ProductModal.tsx` atual. Conforme `loja-item-001.png`.

Nova rota: `/:slug/produto/:productId`

Layout alvo:
- **Header mini:** logo + nome da loja + "Aberto agora" + "← Voltar ao cardápio"
- **Background:** mesmo gradiente marrom/laranja da MenuPage
- **Card branco** central:
  - Label "PRODUTO SELECIONADO" + nome do produto + badge "Sem adicionais" / "Com adicionais"
  - Imagem grande do produto (aspect-ratio 16:9 ou 4:3)
  - Nome + descrição completa + preço
  - Variações (se houver): selector de tamanho/sabor
  - Adicionais (se houver): checkboxes/radio por grupo
  - Observações: textarea
  - Seletor quantidade (−/+)
  - Botão CTA "Adicionar • R$ XX,XX" full width (fundo marrom/vermelho)
- **Carrinho flutuante** verde

### Subtasks
- [x] Criar `web/src/modules/menu/pages/ItemPage.tsx`
  - `useParams` para `slug` e `productId`
  - `useQuery` para `GET /api/menu/:slug/products/:productId` (criar se não existir)
  - Toda lógica de variações + adicionais + quantidade de `ProductModal.tsx`
  - Ao "Adicionar": adiciona ao cartStore e redireciona para `/:slug`
- [x] Adicionar rota `/:slug/produto/:productId` em `App.tsx`
- [x] Atualizar `ProductCard.tsx`: ao clicar → navegar para `/:slug/produto/:productId` (em vez de abrir modal)
- [x] `ProductModal.tsx` pode ser mantido mas não será mais o caminho primário

### Critérios de Aceitação
- [x] URL única por produto (`/:slug/produto/:id`)
- [x] Variações e adicionais funcionam igual ao modal
- [x] "Adicionar" adiciona ao carrinho e volta ao cardápio
- [x] "Voltar ao cardápio" funciona
- [x] Mobile: layout responsivo

### Arquivos Criados
- `web/src/modules/menu/pages/ItemPage.tsx`

### Arquivos Modificados
- `web/src/App.tsx`
- `web/src/modules/menu/components/ProductCard.tsx`

### Tempo Estimado
6-8 horas

---

## TASK-115: CheckoutDrawer — Substituir CheckoutPage por Drawer Lateral

**Epic:** 08-Admin-UI-Redesign  
**Story:** UI/UX Spec v2.0 — Seção 5.10  
**Estimativa:** 8 story points  
**Dependências:** TASK-114

### Descrição
Redesenhar o checkout de página separada (`CheckoutPage.tsx`) para um drawer lateral que abre sobre a `ItemPage` ou `MenuPage`. Conforme `loja-carrinho-001.png`.

Layout alvo (drawer lateral direito):
- **Header:** "Finalizar seu pedido" + subtítulo com nome da loja + botão X para fechar
- **Resumo:** valor total + contagem de itens
- **Tabs:** Entrega / Retirada
- **Campos:** Seu WhatsApp + Seu nome
- **Resumo financeiro:** Subtotal + Taxa de entrega + Pagamento (Pix)
- **Botão CTA** "Finalizar pedido >" (full width, vermelho/marrom)
- **Link** "Limpar carrinho"

### Subtasks
- [x] Criar `web/src/modules/menu/components/CheckoutDrawer.tsx`
  - Usar shadcn/ui `Sheet` (drawer lateral) ou implementar com `fixed inset-y-0 right-0`
  - Toda lógica de `CheckoutPage.tsx` migrada para o drawer
  - Props: `open: boolean`, `onClose: () => void`
- [x] Integrar `CheckoutDrawer` em `MenuPage.tsx` e `ItemPage.tsx`
  - Botão "Carrinho (N)" abre o drawer
- [x] Manter `CheckoutPage.tsx` como fallback (redirect para `/:slug` se acessada diretamente com `?checkout=1` param)
- [x] Atualizar `CartFloat.tsx` para abrir o drawer em vez de navegar para `/checkout`

### Critérios de Aceitação
- [x] Drawer abre ao clicar no botão flutuante de carrinho
- [x] Formulário de checkout funcional (identidade + endereço + pagamento)
- [x] Finalizar pedido cria pedido na API e mostra confirmação
- [x] Drawer fecha sem perder dados do formulário
- [x] Mobile: drawer ocupa 100% da largura

### Arquivos Criados
- `web/src/modules/menu/components/CheckoutDrawer.tsx`

### Arquivos Modificados
- `web/src/modules/menu/pages/MenuPage.tsx`
- `web/src/modules/menu/pages/ItemPage.tsx`
- `web/src/modules/menu/components/CartFloat.tsx`

### Tempo Estimado
6-8 horas

---

## Resumo das Tasks

| Task | Descrição | Pts | Dep |
|---|---|---|---|
| TASK-100 | Design tokens — cor primária vermelha | 2 | — |
| TASK-101 | AdminLayout + AdminSidebar | 8 | 100 |
| TASK-102 | StoreStatusToggle na sidebar | 3 | 101 |
| TASK-103 | Badge pedidos novos na sidebar | 2 | 101 |
| TASK-104 | Rotas PT + AdminLayout em todas as páginas | 5 | 101 |
| TASK-105 | AdminDashboardPage completo | 13 | 104 |
| TASK-106 | Redesign PedidosPage — Kanban + filtros | 8 | 104 |
| TASK-107 | Redesign ProdutosPage — pills + ordenação | 5 | 104 |
| TASK-108 | Redesign CategoriasPage — formulário inline | 3 | 104 |
| TASK-109 | AdicionaisPage — nova página | 8 | 104 |
| TASK-110 | BairrosPage — página standalone | 5 | 104 |
| TASK-111 | HorariosPage — página standalone | 5 | 104 |
| TASK-112 | QRCodePage — renomear TablesPage | 2 | 104 |
| TASK-113 | Redesign MenuPage — store header + grid | 8 | — |
| TASK-114 | ItemPage — página dedicada de produto | 8 | 113 |
| TASK-115 | CheckoutDrawer — drawer lateral | 8 | 114 |

**Total:** 89 story points

---

## Ordem de Execução Recomendada

```
TASK-100 (tokens)
  ↓
TASK-101 (AdminLayout + Sidebar)
  ├── TASK-102 (StoreToggle)
  ├── TASK-103 (Badge pedidos)
  └── TASK-104 (Rotas PT + wrap páginas)
        ├── TASK-105 (Dashboard)
        ├── TASK-106 (Pedidos redesign)
        ├── TASK-107 (Produtos redesign)
        ├── TASK-108 (Categorias redesign)
        ├── TASK-109 (Adicionais page)
        ├── TASK-110 (Bairros page)
        ├── TASK-111 (Horários page)
        └── TASK-112 (QRCode page)

TASK-113 (MenuPage redesign) — independente do admin
  ↓
TASK-114 (ItemPage)
  ↓
TASK-115 (CheckoutDrawer)
```

---

## Definition of Done (Epic)

- [x] Sidebar aparece em todas as páginas `/admin/*`
- [x] Todos os 9 itens de navegação funcionam
- [x] Toggle Aberto/Fechado funcional na sidebar
- [x] Badge de pedidos novos atualiza em tempo real
- [x] `/admin/dashboard` com dados reais
- [x] `/admin/bairros` e `/admin/horarios` standalone
- [x] `/admin/adicionais` com CRUD de grupos e itens
- [x] Loja pública com header card + grid + checkout drawer
- [x] Rotas antigas redirecionam para novas rotas PT
- [x] Zero erros TypeScript
- [x] Mobile responsivo (loja pública prioridade)
- [x] Screenshots validados contra `.local/pessoal/assets/*.png`
