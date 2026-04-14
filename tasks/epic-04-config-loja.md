# Epic 04 — Configurações da Loja (Admin)

> US-003B (Configurações), US-003C (Blacklist/Whitelist)

**Total estimado:** 21 story points

---

## TASK-050: Configurações — Dados da Loja e Horários

**Epic:** 04-Config  
**Story:** US-003B  
**Estimativa:** 5 pts  
**Dependências:** TASK-012 (multi-tenant)

### Subtasks
- [x] Endpoint `PATCH /api/v1/admin/store` → atualizar dados da loja (nome, logo, descrição, endereço)
- [x] Upload de logo via Cloudinary (reutilizar TASK-042)
- [x] Endpoints de horário de funcionamento:
  - `GET /admin/store/hours` → listar 7 dias (Dom-Sáb)
  - `PUT /admin/store/hours` → salvar/atualizar todos os dias de uma vez
  - Schema: `dayOfWeek (0-6)`, `openTime (HH:mm)`, `closeTime (HH:mm)`, `isClosed (bool)`
- [x] Botão de abertura/fechamento manual:
  - `PATCH /admin/store/status` → `{ manualOpen: true | false | null }`
  - `null` = controle automático por horário
  - Estado manual tem prioridade sobre horário programado
  - Frontend: toggle "Loja Aberta / Loja Fechada" destacado no dashboard
- [x] Tela `/admin/settings` com tabs: Dados, Horários, Pagamentos, Entrega, Motoboys

### Critérios de Done
- [x] Dados da loja salvos e refletem no cardápio público
- [x] Horários de funcionamento por dia funcionam
- [x] Toggle manual abre/fecha loja imediatamente
- [x] Estado manual persiste após refresh
- [ ] Cardápio público exibe "Fechado" quando loja fechada (Sprint 6 - TASK-062)
- [x] Unit: cálculo de status atual (aberto/fechado) com hora atual + horários

---

## TASK-051: Configurações — WhatsApp e Chave Pix

**Epic:** 04-Config  
**Story:** US-003B  
**Estimativa:** 3 pts  
**Dependências:** TASK-050, TASK-010 (reauth)

### Subtasks
- [x] Alterar número do WhatsApp:
  - Endpoint com reautenticação obrigatória (confirmação de senha)
  - Ao alterar: AuditLog registrado com valor anterior/novo
  - TODO Sprint 8: invalidar conexão Baileys atual + notificar admin para reconectar via QR Code
- [x] Cadastrar/alterar chave Pix:
  - Tipos: CPF, CNPJ, EMAIL, PHONE, EVP
  - Endpoint com reautenticação obrigatória
  - AuditLog: ação registrada com valor anterior/novo
- [x] Formulário de configuração com campos masked (CPF/CNPJ)

### Critérios de Done
- [x] Alterar WhatsApp sem senha retorna 403
- [x] Alterar Pix sem senha retorna 403
- [x] AuditLog registra ambas as ações com valor anterior e novo

---

## TASK-052: Configurações — Formas de Pagamento e Retirada

**Epic:** 04-Config  
**Story:** US-003B  
**Estimativa:** 3 pts  
**Dependências:** TASK-050

### Subtasks
- [x] Toggle: habilitar/desabilitar "Pagar na entrega" → afeta Store.allowCashOnDelivery
- [x] Toggle: habilitar/desabilitar "Pix" como forma de pagamento (armazenado em Store.features.allowPix)
- [x] Toggle: habilitar/desabilitar "Retirada na loja" → afeta Store.allowPickup
- [x] Quando retirada habilitada: endereço da loja exibido ao cliente no checkout
- [x] Configuração de taxa de serviço (percentual para consumo local): `Store.serviceChargePercent`
- [x] Endpoint `PATCH /admin/store/payment-settings`

### Critérios de Done
- [x] Pagar na entrega desabilitado → opção some do checkout do cliente
- [x] Pix desabilitado → opção some do checkout
- [x] Retirada habilitada → endereço aparece no checkout
- [x] Taxa de serviço salva e aplicada ao fechar comanda

---

## TASK-053: Configurações — Cadastro de Motoboys

**Epic:** 04-Config  
**Story:** US-003B  
**Estimativa:** 3 pts  
**Dependências:** TASK-010 (auth)

### Subtasks
- [x] Endpoint `POST /admin/store/motoboys` → criar motoboy (nome, WhatsApp, email, senha)
- [x] Endpoint `DELETE /admin/store/motoboys/:id` → remover motoboy
- [x] Endpoint `GET /admin/store/motoboys` → listar motoboys da loja
- [x] Senha armazenada com bcrypt (salt 12)
- [x] Um motoboy só pode estar cadastrado em uma loja (storeId único)
- [x] Tela de listagem com botão "Adicionar Motoboy" e "Remover"

### Critérios de Done
- [x] Motoboy criado consegue fazer login em `/{slug}/motoboy`
- [x] Motoboy de Loja A não aparece na listagem de Loja B
- [x] Remover motoboy invalida todos os refresh tokens dele
- [ ] Integration: criar motoboy → login → acesso ao painel (Sprint 8 - TASK-083)

---

## TASK-054: Blacklist e Whitelist de Clientes

**Epic:** 04-Config  
**Story:** US-003C  
**Estimativa:** 8 pts  
**Dependências:** TASK-052

### Subtasks
- [x] Modelo `ClientPaymentAccess` (storeId, clientId, type: BLACKLIST | WHITELIST)
- [x] Endpoint `GET /admin/store/clients` → lista clientes da loja (base de usuários que já fizeram pedido)
- [x] Endpoint `POST /admin/store/payment-access` → adicionar cliente à blacklist ou whitelist
- [x] Endpoint `DELETE /admin/store/payment-access/:clientId` → remover cliente da lista
- [x] Regra: blacklist usada quando "pagar na entrega" está **habilitado** → esses clientes não veem a opção
- [x] Regra: whitelist usada quando "pagar na entrega" está **desabilitado** → apenas esses clientes veem a opção
- [x] Frontend Admin: interface de busca de clientes + seleção + listagem dos selecionados
- [x] Backend de checkout: `getPaymentMethodsForClient(clientId, storeId)` implementado
- [x] Cliente bloqueado vê apenas "Pix" — sem mensagem de bloqueio explícita
- [x] Apenas clientes com histórico na loja podem ser adicionados às listas
- [x] Isolamento multi-tenant: listas por storeId

### Critérios de Done
- [x] Cliente blacklistado não vê "pagar na entrega"
- [x] Cliente não blacklistado vê normalmente
- [x] Quando desabilitado + whitelist: só clientes da lista veem a opção
- [x] Cliente desconhecido (sem histórico) não aparece na busca para adicionar à lista
- [x] Unit: `getPaymentMethodsForClient(clientId, storeId)`
- [ ] Integration: blacklist/whitelist aplicada no endpoint de checkout (Sprint 7 - TASK-065)
