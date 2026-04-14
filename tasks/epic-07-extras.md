# Epic 07 — Extras e Funcionalidades Avançadas

> US-013 (Cupons), US-014 (Área de Entrega), US-015 (Agendamento), US-016 (Analytics), US-017 (Facebook Pixel), US-018 (Controle de Caixa), US-019 (Ranking de Clientes)

**Total estimado:** 79 story points

---

## TASK-090: Cupons de Desconto (Plano Premium)

**Epic:** 07-Extras  
**Story:** US-013  
**Estimativa:** 8 pts  
**Dependências:** TASK-064 (checkout), TASK-010 (reauth)

### Subtasks
- [x] CRUD: `GET/POST /admin/coupons`, `PATCH/DELETE /admin/coupons/:id`
- [x] Schema Zod: código (texto, único na loja), tipo (PERCENTAGE | FIXED), valor, validade (início/fim), limite de usos (null = ilimitado)
- [x] Reautenticação obrigatória em create/update/delete + AuditLog
- [x] Feature flag: `coupon_manage` (Plano 2)
- [x] Frontend: tela `/admin/coupons` com listagem e formulário
- [x] Endpoint público `POST /menu/:slug/coupon/validate` → valida código + retorna desconto
- [x] Validações: código válido, dentro da validade, abaixo do limite de usos
- [x] Ao criar pedido com cupom: `Order.couponId`, `Order.discount`, incrementar `Coupon.usedCount`
- [x] Campo no carrinho (`coupon_redeem`): todos os planos, mas oculto se `!coupon_manage`

### Critérios de Done
- [x] Cupom criado e validado no carrinho
- [x] Desconto % e fixo calculados corretamente
- [x] Cupom expirado retorna erro 422
- [x] Cupom com limite atingido retorna erro 422
- [x] Feature flag bloqueia create/edit/delete para Plano 1
- [x] Unit: cálculo de desconto, validação de validade
- [x] Integration: criar cupom + usar no checkout

---

## TASK-091: Área de Entrega e Taxas (Plano Premium)

**Epic:** 07-Extras  
**Story:** US-014  
**Estimativa:** 21 pts  
**Dependências:** TASK-064 (checkout)

### Subtasks

**Modo por bairro:**
- [x] CRUD: `GET/POST/PATCH/DELETE /admin/delivery/neighborhoods`
- [x] Schema: nome do bairro, taxa (R$)
- [x] Endpoint de consulta pública: `POST /menu/:slug/delivery/calculate` → `{ neighborhood }` → retorna taxa
- [x] "Não entregamos neste bairro" se bairro não cadastrado
- [x] Tela de gestão de bairros no admin

**Modo por distância:**
- [x] CRUD: `GET/POST/PATCH/DELETE /admin/delivery/distances`
- [x] Schema: minKm, maxKm, fee
- [x] Cálculo Haversine: distância entre endereço da loja e endereço do cliente
- [x] Precisar de coordenadas: integrar com API de CEP (ViaCEP) para obter lat/lng ou geocodificação
- [x] Endpoint: `POST /menu/:slug/delivery/calculate` → `{ address }` → retorna taxa
- [x] "Não entregamos neste local" se além do raio máximo

**Geral:**
- [x] Admin escolhe modo ativo (NEIGHBORHOOD | DISTANCE) — mutuamente exclusivo
- [x] Atualizar `Store.deliveryMode`
- [x] Retirada na loja sempre taxa R$ 0,00
- [x] Feature flag: `delivery_area` (Plano 2)
- [x] Plano 1: taxa fixa única nas configurações básicas da loja (campo simples)
- [x] Taxa exibida no carrinho antes de finalizar

### Critérios de Done
- [x] Modo bairro: bairro cadastrado → taxa exibida; bairro não cadastrado → mensagem de erro
- [x] Modo distância: Haversine calculado corretamente; fora do raio → mensagem de erro
- [x] Apenas um modo ativo por vez
- [x] Feature flag bloqueia para Plano 1 (exceto taxa fixa básica)
- [x] Unit: cálculo Haversine
- [x] Integration: checkout com taxa por bairro e por distância

---

## TASK-092: Agendamento de Pedidos (Plano Premium)

**Epic:** 07-Extras  
**Story:** US-015  
**Estimativa:** 8 pts  
**Dependências:** TASK-065 (criar pedido)

### Subtasks
- [x] Campo "Agendar para" no checkout (data/hora)
- [x] Validação: mínimo 30 min de antecedência
- [x] Validação: horário dentro do horário de funcionamento da loja
- [x] Salvar `Order.scheduledFor`
- [x] Bull job: verificar pedidos agendados a cada minuto → notificar admin 15 min antes
- [x] Pedido agendado entra no Kanban somente no horário agendado
- [x] Feature flag: `schedule` (Plano 2)

### Critérios de Done
- [x] Pedido agendado para 2h à frente criado com sucesso
- [x] Pedido com menos de 30 min de antecedência bloqueado
- [x] Admin recebe notificação 15 min antes do horário agendado
- [x] Feature flag bloqueia para Plano 1

---

## TASK-093: Analytics — Dashboard de Vendas

**Epic:** 07-Extras  
**Story:** US-016  
**Estimativa:** 13 pts  
**Dependências:** TASK-065 (pedidos)

### Subtasks
- [x] Endpoints analíticos (filtrados por storeId):
  - [x] `GET /admin/analytics/sales?period=day|week|month` → total vendido, nº pedidos, ticket médio
  - [x] `GET /admin/analytics/top-products?period=...` → produtos mais vendidos (rank)
  - [x] `GET /admin/analytics/peak-hours` → horários de pico (pedidos por hora)
  - [x] `GET /admin/analytics/conversion` → visitas ao cardápio vs pedidos criados (requer tracking básico)
- [x] `npm install chart.js react-chartjs-2`
- [x] Tela `/admin/analytics` com:
  - [x] Gráfico de linha: vendas por dia/semana/mês
  - [x] Card: ticket médio, total pedidos, total vendido
  - [x] Bar chart: top 10 produtos
  - [x] Heatmap ou bar chart: horários de pico
- [x] Feature flag: `analytics` (todos os planos)
- [x] Cache Redis para queries analíticas: TTL 10min

### Critérios de Done
- [x] Dashboard carrega sem erro com dados reais
- [x] Filtro de período funciona
- [x] Gráficos renderizam corretamente em mobile e desktop
- [x] Performance: query analytics < 500ms

---

## TASK-094: Ranking de Clientes

**Epic:** 07-Extras  
**Story:** US-019  
**Estimativa:** 8 pts  
**Dependências:** TASK-065 (pedidos)

### Subtasks
- [x] Endpoint `GET /admin/clients/ranking?period=7d|30d|90d|all`
- [x] Query: agrupar pedidos por clientId (WhatsApp), contar pedidos, somar valor gasto, última data de pedido
- [x] Retornar: posição, nome/WhatsApp, total pedidos, valor total gasto, data último pedido
- [x] Tela `/admin/clients`:
  - [x] Tabela paginada com ranking
  - [x] Seletor de período
  - [x] Destaque visual para top 3 (ouro/prata/bronze)
  - [x] Busca por nome ou WhatsApp
  - [x] Botão "Exportar CSV"
- [x] Feature flag: `customer_ranking` (todos os planos)

### Critérios de Done
- [x] Ranking calculado corretamente por período
- [x] Top 3 destacados visualmente
- [x] Export CSV funcional
- [x] Admin vê apenas clientes da própria loja

---

## TASK-095: Controle de Caixa

**Epic:** 07-Extras  
**Story:** US-018  
**Estimativa:** 16 pts  
**Dependências:** TASK-065 (pedidos), TASK-010 (reauth)

### Subtasks

**Abertura:**
- [x] Caixa abre automaticamente no horário de início do funcionamento (Bull job)
- [x] Abertura manual: `POST /admin/cashflow` com reautenticação + AuditLog
- [x] Não permite dois caixas abertos simultaneamente

**Durante o turno:**
- [x] Endpoint `PATCH /admin/cashflow/:id/initial-amount` → ajustar troco inicial (reauth + log)
- [x] Endpoint `POST /admin/cashflow/:id/adjustments` → sangria ou suprimento (reauth + log)
  - Schema: `type: BLEED | SUPPLY`, `amount`, `notes`
- [x] Endpoint `GET /admin/cashflow/:id/summary` → resumo parcial:
  - Total de pedidos até o momento
  - Por forma de pagamento: Pix, Dinheiro, Cartão
  - Saldo esperado em dinheiro (troco + suprimentos − sangrias + entradas dinheiro)
  - Sangrias e suprimentos do turno
- [x] Pedidos confirmados durante turno → automaticamente vinculados ao caixa aberto (CashFlowItem)

**Fechamento:**
- [x] Caixa fecha automaticamente no horário de encerramento (Bull job)
- [x] Fechamento manual: `POST /admin/cashflow/:id/close` com reauth + AuditLog
- [x] Campo: valor físico contado em caixa (apenas dinheiro)
- [x] Sistema calcula diferença (esperado − contado)
- [x] Justificativa obrigatória se houver diferença
- [x] Relatório de fechamento salvo permanentemente (sem possibilidade de delete)
- [x] Histórico: `GET /admin/cashflows` (lista de caixas anteriores)

**Regras gerais:**
- [x] Feature flag: `cashflow` (todos os planos)
- [x] AuditLog em toda ação (abertura manual, ajuste, sangria, suprimento, fechamento)
- [x] Apenas Admin com senha tem acesso
- [x] Após fechamento, nenhum lançamento retroativo

### Critérios de Done
- [x] Caixa abre e fecha automaticamente conforme horário
- [x] Sangria/suprimento registrados corretamente no resumo
- [x] Fechamento calcula diferença e exige justificativa
- [x] Histórico de caixas não pode ser deletado
- [x] Unit: cálculo de saldo esperado (troco + suprimentos − sangrias + entradas)
- [x] Integration: abrir caixa → criar pedido → ver no resumo → fechar caixa

---

## TASK-096: Facebook Pixel (Plano Premium)

**Epic:** 07-Extras  
**Story:** US-017  
**Estimativa:** 5 pts  
**Dependências:** TASK-060 (cardápio público)

### Subtasks
- [x] Campo `facebookPixelId` nas configurações da loja (Plano 2)
- [x] Injetar Pixel script no cardápio público quando `facebookPixelId` configurado
- [x] Eventos: `PageView` (ao abrir cardápio), `ViewContent` (ao abrir produto), `AddToCart` (ao adicionar), `Purchase` (ao finalizar pedido)
- [x] Banner de cookies LGPD/GDPR com aceitar/recusar
- [x] Pixel só dispara após consentimento
- [x] Feature flag: `facebook_pixel` (Plano 2)

### Critérios de Done
- [x] Pixel disparando eventos corretos (verificar via Facebook Pixel Helper)
- [x] Banner de cookies funcional
- [x] Pixel não dispara antes do consentimento
- [x] Feature flag bloqueia para Plano 1
