# Epic 06 — Gestão de Pedidos e Painel do Motoboy (Admin)

> US-009 (Painel de Pedidos), US-009B (Painel Motoboy), US-010 (Impressão Automática)

**Total estimado:** 42 story points

---

## TASK-080: Painel de Pedidos — Kanban em Tempo Real

**Epic:** 06-Pedidos  
**Story:** US-009  
**Estimativa:** 8 pts  
**Dependências:** TASK-065 (criar pedido), TASK-006 (Socket.io)

### Subtasks
- [x] Tela `/admin/orders` com layout Kanban
- [x] Colunas para **Entrega**: Novo → Confirmado → Em Preparo → Pronto p/ Entrega → Saiu p/ Entrega → Entregue
- [x] Colunas para **Retirada**: Novo → Confirmado → Em Preparo → Pronto p/ Retirada → Retirado
- [x] Coluna "Saiu p/ Entrega" oculta em pedidos de retirada
- [x] Card do pedido: número, cliente (nome + WhatsApp), itens (nome + qtd), total, horário, tipo (Mesa/Retirada/endereço), status
- [x] Drag & drop entre colunas (ou botão de avançar status)
- [x] WebSocket: `order:new` adiciona card automaticamente, `order:status` move card
- [x] Som/notificação quando pedido novo chega (Audio API)
- [x] Endpoint `PATCH /admin/orders/:id/status` → muda status com validação de transição
- [x] Filtros: data, status, forma de pagamento

### Critérios de Done
- [x] Novo pedido aparece no Kanban em <300ms
- [x] Drag & drop muda status e persiste
- [x] Som toca ao receber novo pedido
- [x] Filtros funcionando
- [x] Integration: criar pedido → verificar WebSocket emitido

---

## TASK-081: Painel de Pedidos — Detalhe e Ações

**Epic:** 06-Pedidos  
**Story:** US-009  
**Estimativa:** 5 pts  
**Dependências:** TASK-080

### Subtasks
- [x] Modal/drawer de detalhe do pedido: todos os itens + variações + adicionais + observações, endereço completo, forma de pagamento, histórico de status, cliente
- [x] Endpoint `GET /admin/orders/:id` → detalhe completo
- [x] Ação "Aprovar pagamento Pix": muda status de `WAITING_PAYMENT_PROOF` → `CONFIRMED`
- [x] Ação "Confirmar pedido": muda status de `WAITING_CONFIRMATION` → `CONFIRMED`
- [x] Ação "Cancelar pedido": muda status para `CANCELLED` (com motivo opcional)
- [x] Ao cancelar: notificar cliente via WhatsApp

### Critérios de Done
- [x] Detalhe do pedido exibe todos os campos corretamente
- [x] Aprovação de Pix muda status e notifica cliente
- [x] Cancelamento notifica cliente via WhatsApp

---

## TASK-082: Painel de Pedidos — Atribuição de Motoboy

**Epic:** 06-Pedidos  
**Story:** US-009  
**Estimativa:** 5 pts  
**Dependências:** TASK-080, TASK-071 (WhatsApp)

### Subtasks
- [x] Endpoint `PATCH /admin/orders/:id/motoboy` → atribuir motoboy
- [x] Ao marcar pedido de **entrega** como "Pronto para Entrega":
  - [x] Seletor de motoboy (dropdown com lista da loja)
  - [x] Ao confirmar: envia WhatsApp para o motoboy com todos os detalhes + links Waze/Maps
  - [x] Status muda para "Saiu para Entrega" automaticamente
- [x] Ao marcar pedido de **retirada** como "Pronto para Retirada":
  - [x] Sem seleção de motoboy
  - [x] Notifica cliente via WhatsApp "Seu pedido está pronto para retirada"
  - [x] Status permanece "Pronto para Retirada" até Admin marcar "Retirado"
- [x] Links navegação gerados: `https://maps.google.com/?q={endereco}` e `https://waze.com/ul?q={endereco}`

### Critérios de Done
- [x] Motoboy recebe WhatsApp com detalhes completos
- [x] Links Maps e Waze abrem endereço correto
- [x] Status transiciona automaticamente para "Saiu para Entrega"
- [x] Cliente de retirada recebe notificação "pronto para retirar"

---

## TASK-083: Painel do Motoboy — Interface Mobile

**Epic:** 06-Pedidos  
**Story:** US-009B  
**Estimativa:** 8 pts  
**Dependências:** TASK-014 (auth motoboy), TASK-071 (WhatsApp)

### Subtasks
- [x] Página `/{slug}/motoboy` — login (mobile-first)
- [x] Após login: lista de pedidos atribuídos ao motoboy logado
- [x] Tabs: "Ativos" (status: DISPATCHED) e "Histórico" (status: DELIVERED — do dia)
- [x] Card de pedido exibe:
  - [x] Número do pedido
  - [x] Nome + telefone do cliente
  - [x] Endereço completo de entrega
  - [x] Itens (nome, quantidade, observações)
  - [x] Valor total + forma de pagamento
  - [x] Horário em que foi despachado
  - [x] Botões: "Abrir no Maps" + "Abrir no Waze"
- [x] Botão "Marcar como Entregue" em destaque
- [x] Confirmação: ao confirmar → status `DELIVERED` → cliente recebe WhatsApp → pedido move para "Histórico"
- [x] WebSocket: novo pedido atribuído aparece sem reload
- [x] Interface otimizada para uso com uma mão (botões grandes, na parte inferior)
- [x] Isolamento: motoboy vê APENAS pedidos atribuídos a ele (storeId + motoboyId)
- [x] AuditLog: "marcar como entregue" registrado (quem, pedido, quando)
- [x] Motoboy não pode desmarcar "Entregue"

### Critérios de Done
- [x] Lighthouse Mobile Score ≥ 85
- [x] Login funciona (email+senha e OAuth)
- [x] Motoboy da Loja A não vê pedidos da Loja B
- [x] Marcar como entregue → cliente recebe WhatsApp automaticamente
- [x] Unit: validação de role MOTOBOY
- [x] Integration: login → listar pedidos → marcar entregue → verificar WhatsApp
- [x] E2E: login → pedido ativo → clicar Maps → marcar entregue → cliente notificado

---

## TASK-084: Impressão Automática — ESC/POS (Plano Premium)

**Epic:** 06-Pedidos  
**Story:** US-010  
**Estimativa:** 8 pts  
**Dependências:** TASK-080

### Subtasks
- [x] `npm install escpos escpos-usb` (ou alternativa compatível)
- [x] Configurar impressora térmica ESC/POS
- [x] Formato de impressão: número do pedido, data/hora, cliente, itens (nome + qtd + observações), total, forma de pagamento
- [x] Trigger: imprimir automaticamente quando pedido confirmado
- [x] Configuração no painel admin: habilitar/desabilitar auto-print + selecionar momento (confirmado / em preparo)
- [x] Feature flag: `auto_print` (Plano 2 - Premium)
- [x] Tratamento de erro: impressora offline → log + notificação no painel (não quebra o pedido)

### Critérios de Done
- [x] Pedido confirmado → imprime automaticamente (quando habilitado)
- [x] Formato correto (testado com impressora virtual)
- [x] Impressora offline: erro logado, pedido não afetado
- [x] Feature flag bloqueia para lojas sem Premium

---

## TASK-085: Histórico de Pedidos

**Epic:** 06-Pedidos  
**Story:** US-009  
**Estimativa:** 3 pts  
**Dependências:** TASK-080

### Subtasks
- [x] Endpoint `GET /admin/orders` com filtros: data (início/fim), status, forma de pagamento
- [x] Paginação (cursor-based, 20 itens por página)
- [x] Tela `/admin/orders/history` com listagem e filtros
- [x] Exportar para CSV (opcional, pode ser posterior)

### Critérios de Done
- [x] Filtros de data funcionando
- [x] Paginação funcional
- [x] Performance: query < 100ms para 10k pedidos (índices confirmados)

---

## TASK-086: Pix — Geração de QR Code e Copia e Cola

**Epic:** 06-Pedidos  
**Story:** US-011  
**Estimativa:** 5 pts  
**Dependências:** TASK-051 (config Pix)

### Subtasks
- [x] `npm install pix-utils` (ou implementar geração de payload Pix)
- [x] Ao criar pedido com pagamento Pix:
  - [x] Gerar payload Pix estático com chave configurada da loja
  - [x] Gerar QR Code Pix (base64 PNG)
  - [x] Gerar string Pix Copia e Cola
- [x] Exibir na tela de confirmação do pedido: QR Code + Copia e Cola + instrução de envio de comprovante
- [x] Admin marca pagamento como confirmado manualmente
- [x] Sem integração automática de confirmação (MVP: manual)

### Critérios de Done
- [x] QR Code Pix gerado e válido (testado com app bancário)
- [x] Copia e Cola válido
- [x] Admin consegue marcar pagamento como confirmado
- [x] Unit: geração de payload Pix com diferentes tipos de chave
