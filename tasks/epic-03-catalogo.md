# Epic 03 — Gestão de Cardápio (Admin)

> US-003 (Criar/Editar Produtos), US-004 (QR Code Mesa/Comanda)

**Total estimado:** 26 story points

---

## TASK-040: Categorias — CRUD

**Epic:** 03-Catalogo  
**Story:** US-003  
**Estimativa:** 3 pts  
**Dependências:** TASK-012 (multi-tenant middleware)

### Subtasks
- [x] Endpoints CRUD: `GET/POST /admin/categories`, `PATCH/DELETE /admin/categories/:id`
- [x] Schema Zod: nome, ordem
- [x] Ordenação drag & drop (campo `order`)
- [x] Soft toggle: `isActive` (categorias inativas não aparecem no cardápio público)
- [x] Tela `/admin/categories` com listagem + formulário
- [x] Todas as queries filtram por `storeId`

### Critérios de Done
- [x] CRUD completo funcionando
- [x] Ordem respeitada na listagem
- [x] Admin de outra loja não acessa (403)
- [x] Unit: validação de nome único por storeId

---

## TASK-041: Produtos — CRUD Individual

**Epic:** 03-Catalogo  
**Story:** US-003  
**Estimativa:** 8 pts  
**Dependências:** TASK-040, TASK-042 (Cloudinary)

### Subtasks
- [x] Endpoints: `GET/POST /admin/products`, `PATCH/DELETE /admin/products/:id`
- [x] Schema Zod: nome (único na loja), descrição, preço, categoryId, imageUrl, isActive, ordem
- [x] Variações: `ProductVariation[]` (nome, preço) — inline no formulário de produto
- [x] Adicionais: `ProductAdditional[]` (nome, preço) — inline no formulário
- [x] Reautenticação obrigatória (confirmação de senha) em create/update/delete
- [x] AuditLog gerado em cada ação sensível
- [x] Preview em tempo real (como cliente veria)
- [x] Tela `/admin/products` com listagem, busca, toggle ativo/inativo
- [x] Tela `/admin/products/new` e `/admin/products/:id/edit`
- [x] Invalidar cache Redis `menu:{storeId}` após qualquer CRUD
- [x] Emitir Socket.io `menu:updated` para sala `store:{storeId}`

### Critérios de Done
- [x] Produto criado com variações e adicionais
- [x] Reautenticação bloqueia sem senha correta
- [x] Cache Redis invalidado após CRUD
- [x] Socket.io emite `menu:updated`
- [x] Nome duplicado na loja retorna 422
- [x] RN-006 Foto obrigatória (sem foto → bloqueia submit)
- [x] Unit: validateProductName, validatePrice
- [x] Integration: create + Cloudinary mock + cache invalidation
- [x] E2E: admin cria pizza com 3 tamanhos → aparece no cardápio público

---

## TASK-042: Cloudinary — Upload de Imagens

**Epic:** 03-Catalogo  
**Story:** US-003  
**Estimativa:** 3 pts  
**Dependências:** TASK-001

### Subtasks
- [x] `npm install cloudinary multer`
- [x] Configurar Cloudinary SDK com `CLOUDINARY_URL`
- [x] Endpoint `POST /admin/upload` → recebe imagem (max 5MB) → upload para Cloudinary → retorna URL
- [x] Transformação automática: WebP, quality auto, width auto
- [x] Pasta no Cloudinary: `supercardapio/{storeId}/products/`
- [x] Validação: só aceita image/jpeg, image/png, image/webp
- [x] Frontend: componente de upload com preview

### Critérios de Done
- [x] Upload de imagem retorna URL Cloudinary válida
- [x] Arquivo > 5MB retorna 413
- [x] Tipo inválido retorna 422
- [x] URL usa `format=auto&width=auto`
- [x] Unit: validação de tipo e tamanho
- [x] Integration: upload mockado

---

## TASK-043: Produtos — Importação em Massa CSV/XLSX

**Epic:** 03-Catalogo  
**Story:** US-003  
**Estimativa:** 5 pts  
**Dependências:** TASK-041

### Subtasks
- [x] `npm install xlsx exceljs`
- [x] Template CSV/XLSX para download: colunas nome, descrição, preço, categoria, variações, adicionais
- [x] Endpoint `GET /admin/products/template` → retorna arquivo XLSX
- [x] Endpoint `POST /admin/products/import` → recebe planilha → valida → cria/atualiza em lote
- [x] Validação por linha: nome, preço, categoria existente
- [x] Relatório de erros retornado por linha (ex: "linha 5: preço inválido")
- [x] Reimportar sobrescreve (upsert por nome do produto)
- [x] Reautenticação obrigatória + AuditLog
- [x] Invalidar `menu:{storeId}` após importação

### Critérios de Done
- [x] Template baixado corretamente
- [x] Importação cria todos os produtos válidos
- [x] Erros por linha retornados no response
- [x] Linhas inválidas não bloqueiam linhas válidas
- [x] Integration: importar planilha com 50 produtos

---

## TASK-044: QR Code de Mesa e Comanda

**Epic:** 03-Catalogo  
**Story:** US-004  
**Estimativa:** 13 pts  
**Dependências:** TASK-041, TASK-006 (Socket.io)

### Subtasks
- [x] CRUD de mesas: `GET/POST /admin/tables`, endpoint por mesa
- [x] Endpoint `GET /admin/tables/:id/qrcode` → gera QR Code (PNG + PDF A4 com logo e número da mesa)
- [x] `npm install qrcode pdfkit`
- [x] QR aponta para `{slug}.${PUBLIC_ROOT_DOMAIN}?mesa={number}`
- [x] Endpoint `POST /admin/tables/:id/close` → encerra comanda (libera mesa)
- [x] Frontend Admin:
  - [x] Painel de mesas com status (ocupada/livre)
  - [x] Comanda aberta: lista itens agrupados por adição, estado de cada item (Pendente/Em Preparo/Entregue)
  - [x] Marcar item individual como "Entregue"
  - [x] Resumo de fechamento: itens, subtotais, taxa de serviço opcional, total
  - [x] Impressão de resumo da comanda
- [x] Frontend Cliente (cardápio com `?mesa=N`):
  - [x] Sem campo de endereço, sem formas de pagamento
  - [x] Botão "Adicionar à comanda" em vez de "Fazer pedido"
  - [x] Após envio: tela "Obrigado, itens adicionados à sua comanda!"
  - [x] Status dos itens em tempo real via WebSocket
- [x] WebSocket: novos itens aparecem em tempo real no painel Admin
- [x] Feature flag: `qrcode_table` (todos os planos)
- [x] Regra: uma mesa só pode ter uma comanda aberta por vez
- [x] Taxa de serviço: percentual configurável, opcional no fechamento

### Critérios de Done
- [x] QR Code gerado e scanável
- [x] PDF A4 com logo e número da mesa imprimível
- [x] Admin vê itens chegando em tempo real
- [x] Cliente vê status dos itens em tempo real
- [x] Comanda encerrada libera a mesa
- [x] Mesa com comanda aberta bloqueia nova comanda
- [x] Unit: cálculo de total com taxa de serviço
- [x] Integration: criar mesa, abrir comanda, adicionar itens, fechar
- [x] E2E: cliente escaneia QR → adiciona pizza → admin vê em tempo real
