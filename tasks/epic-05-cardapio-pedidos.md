# Epic 05 — Cardápio Público e Pedidos (Cliente)

> US-005 (Cardápio Público), US-006 (Carrinho + Finalizar Pedido), US-007 (WhatsApp Status), US-008 (IA WhatsApp)

**Total estimado:** 81 story points

---

## TASK-060: Cardápio Público — Estrutura e Performance

**Epic:** 05-Cardapio  
**Story:** US-005  
**Estimativa:** 8 pts  
**Dependências:** TASK-041 (produtos), TASK-004 (Redis)

### Subtasks
- [x] Endpoint público `GET /api/v1/menu/:slug` → cardápio completo da loja (sem auth)
  - Cache Redis: `menu:{storeId}` TTL 5min
  - Retorna: store info + categorias + produtos + variações + adicionais
- [x] Roteamento multi-tenant no frontend: subdomínio `{slug}.${PUBLIC_ROOT_DOMAIN}` → extrai slug → busca storeId
- [x] Página `/{slug}` mobile-first:
  - [x] Lista de categorias (tabs horizontais deslizáveis)
  - [x] Grid de produtos com foto, nome, descrição, preço
  - [x] Skeleton loading (não spinner)
  - [x] Lazy loading de imagens fora do viewport
  - [x] Fotos Cloudinary com `format=auto&width=auto` (WebP automático)
- [x] TanStack Query: `staleTime: 5min` para dados do cardápio
- [x] Socket.io: escutar `menu:updated` → `queryClient.invalidateQueries(['menu', storeId])`
- [x] Touch targets mínimos 44×44px
- [x] Sem overflow horizontal em nenhum viewport mobile
- [x] Fonte mínima 16px nos inputs

### Critérios de Done
- [x] Lighthouse Mobile Score ≥ 85
- [x] FCP < 1.5s em throttle 3G
- [x] Cardápio atualiza em <1s após admin editar produto
- [x] Sem overflow horizontal em 320px viewport
- [x] Integration: `GET /menu/:slug` → retorna cardápio do cache Redis

---

## TASK-061: Cardápio Público — Busca e Filtros

**Epic:** 05-Cardapio  
**Story:** US-005  
**Estimativa:** 3 pts  
**Dependências:** TASK-060

### Subtasks
- [x] Campo de busca em tempo real (filtro client-side — sem nova request)
- [x] Filtros: vegetariano (tag no produto), sem glúten (tag no produto), promoções (preço com desconto)
- [x] Adicionar campos `tags: string[]` ao model Product (ou campo Json)
- [x] Filtro ativo: destaque visual + contador de resultados

### Critérios de Done
- [x] Busca filtra instantaneamente sem re-request
- [x] Filtros combinam (ex: vegetariano + sem glúten)
- [x] Sem resultado exibe mensagem amigável

---

## TASK-062: Cardápio — Loja Fechada e Suspensa

**Epic:** 05-Cardapio  
**Story:** US-005, RN-004  
**Estimativa:** 2 pts  
**Dependências:** TASK-060, TASK-050

### Subtasks
- [x] Backend: endpoint de menu retorna `storeStatus` (aberta/fechada/suspensa)
- [x] Cardápio exibe banner "Estamos fechados. Abrimos às 18h" quando fora do horário
- [x] Cardápio exibe "No momento não estamos operando online" quando SUSPENDED
- [x] Botão de finalizar pedido bloqueado quando fechada ou suspensa
- [x] Agendamento de pedido **permitido** quando loja fechada (US-015)

### Critérios de Done
- [x] Loja fechada: banner exibido, finalização bloqueada
- [x] Loja suspensa: mensagem específica exibida
- [x] Cálculo de status usa `manualOpen` + horário com fuso correto (America/Sao_Paulo)

---

## TASK-063: Carrinho de Compras

**Epic:** 05-Cardapio  
**Story:** US-006  
**Estimativa:** 5 pts  
**Dependências:** TASK-060

### Subtasks
- [x] Estado do carrinho: Zustand (persiste no localStorage até checkout)
- [x] Componente floating do carrinho (sempre visível)
- [x] Modal de produto: escolher variação (tamanho), adicionais, quantidade, observações
- [x] Resumo: itens + qtd + preço unitário + total por item
- [x] Atualizar quantidade / remover item
- [x] Carrinho pré-montado via hash (para IA — US-008): `/{slug}/carrinho/{hash}` → popula Zustand
- [x] Persistência: carrinho mantido após refresh (localStorage)

### Critérios de Done
- [x] Adicionar produto com variações e adicionais ao carrinho
- [x] Subtotal calculado corretamente (variação + adicionais)
- [x] Carrinho persiste no reload
- [x] Link de carrinho pré-montado popula corretamente

---

## TASK-064: Checkout — Identificação e Endereço

**Epic:** 05-Cardapio  
**Story:** US-006  
**Estimativa:** 5 pts  
**Dependências:** TASK-063, TASK-054 (blacklist)

### Subtasks
- [x] Campo: WhatsApp do cliente (11 dígitos) — cria ou encontra User existente
- [x] Campo: Nome do cliente (opcional no primeiro pedido, lembrado nas próximas)
- [x] Seleção de tipo: **Entrega** ou **Retirada na loja** (ou **Mesa** se `?mesa=N`)
- [x] Quando **Entrega**: mostrar campos de endereço (rua, número, complemento, bairro)
  - Calcular taxa de entrega conforme configuração da loja (por bairro ou distância)
  - Exibir taxa antes de finalizar
  - "Não entregamos neste local" se fora da área
- [x] Quando **Retirada**: ocultar campos de endereço; taxa = R$ 0,00; exibir endereço da loja
- [x] Campo de cupom: digitar código → aplicar desconto (feature `coupon_redeem` — todos os planos; oculto se admin não tem `coupon_manage`)
- [x] Total em tempo real: subtotal + taxa entrega − desconto cupom
- [x] Validar se loja está aberta antes de finalizar

### Critérios de Done
- [x] Total atualiza em tempo real conforme endereço/tipo/cupom
- [x] Taxa de entrega calculada corretamente por bairro e por distância (Haversine)
- [x] Cupom válido aplica desconto; inválido exibe erro
- [x] WhatsApp inválido bloqueia submit

---

## TASK-065: Checkout — Formas de Pagamento e Criação do Pedido

**Epic:** 05-Cardapio  
**Story:** US-006  
**Estimativa:** 8 pts  
**Dependências:** TASK-064, TASK-054 (blacklist/whitelist)

### Subtasks
- [x] Exibir formas de pagamento conforme configuração da loja + blacklist/whitelist:
  - **Pix:** sempre visível (se habilitado pelo admin)
  - **Pagar na entrega:** conforme regras blacklist/whitelist
- [x] **Se Pix:** exibir chave Pix + tipo + beneficiário + instrução de envio de comprovante
  - Pedido criado com status `WAITING_PAYMENT_PROOF`
- [x] **Se Pagar na entrega:** pedido criado com status `WAITING_CONFIRMATION`
- [x] Endpoint `POST /api/v1/menu/:slug/orders`:
  - Validar loja aberta
  - Validar produtos existem e estão ativos
  - Calcular total (subtotal + entrega − desconto)
  - Criar Order + OrderItems + OrderItemAdditionals
  - Criar/encontrar User por WhatsApp (sem senha, sem login)
  - Incrementar `Order.number` (sequencial por storeId)
  - Retornar `{ orderId, orderNumber, token }` (token para magic link)
- [x] Tela de confirmação: resumo do pedido + link de acompanhamento
- [x] Invalidar cache do Admin (pedidos) via Socket.io `order:new`
- [x] Criar entrada no CashFlow se caixa estiver aberto

### Critérios de Done
- [x] Pedido criado com status correto conforme pagamento
- [x] OrderItems com snapshots (productName, variationName, preços)
- [x] Número do pedido sequencial por loja (não global)
- [x] Socket.io emite `order:new` para admin
- [x] Unit: cálculo de total, validação de produtos ativos
- [x] Integration: criar pedido completo (Entrega + Pix)
- [x] E2E: cliente faz pedido de pizza → admin vê no Kanban

---

## TASK-066: Acompanhamento do Pedido pelo Cliente

**Epic:** 05-Cardapio  
**Story:** US-006  
**Estimativa:** 3 pts  
**Dependências:** TASK-065, TASK-013 (magic link)

### Subtasks
- [x] Página `/{slug}/pedido/{token}`:
  - Valida token JWT (24h)
  - Exibe: número do pedido, itens, total, status atual, histórico de mudanças
  - Atualiza em tempo real via WebSocket
- [x] Status traduzidos: Confirmado, Em Preparo, Saiu para Entrega, Entregue
- [x] Identificação do tipo: "Entrega para Rua X" ou "Retirada na loja"
- [x] Token inválido ou expirado: mensagem amigável

### Critérios de Done
- [x] Página abre sem login via token
- [x] Status atualiza em tempo real quando admin muda no painel
- [x] Token expirado exibe mensagem amigável

---

## TASK-070: WhatsApp — Baileys Setup e Conexão

**Epic:** 05-WhatsApp  
**Story:** US-007  
**Estimativa:** 5 pts  
**Dependências:** TASK-001

### Subtasks
- [x] `npm install @whiskeysockets/baileys`
- [x] Serviço `WhatsAppService` com instância Baileys por loja (storeId)
- [x] Endpoint `GET /admin/whatsapp/qrcode` → gera QR Code para conectar
- [x] Frontend: exibir QR Code + instrução de scan
- [x] Persistir sessão Baileys (arquivo de credenciais por storeId)
- [x] Reconectar automaticamente se cair
- [x] Notificar admin via dashboard quando desconectado
- [x] Endpoint `DELETE /admin/whatsapp` → desconectar instância

### Critérios de Done
- [x] QR Code exibido no painel admin
- [x] Admin scaneai QR → Baileys conectado
- [x] Sessão persiste após restart do servidor
- [x] Desconexão detectada → notificação no painel

---

## TASK-071: WhatsApp — Envio de Mensagens de Status

**Epic:** 05-WhatsApp  
**Story:** US-007  
**Estimativa:** 8 pts  
**Dependências:** TASK-070, TASK-065

### Subtasks
- [x] Mensagem automática após criação do pedido:
  - Para cliente: resumo completo (número, itens, total, endereço ou retirada, forma de pagamento, chave Pix se aplicável, link de acompanhamento)
  - Formato exato conforme spec (ver Jornada 3)
- [x] Mensagem ao motoboy quando pedido atribuído:
  - Nome e telefone do cliente, endereço completo, itens, valor, forma de pagamento, links Waze e Maps, link painel motoboy
- [x] Mensagens de mudança de status (para cliente):
  - Confirmado, Em Preparo, Saiu para Entrega, Entregue
- [x] Mensagem de boas-vindas ao primeiro contato
- [x] Textos padrão do sistema (hardcoded no Plano 1)
- [x] Textos personalizáveis no Plano 2 (US-003B — campo no settings)
- [x] Feature flag: `whatsappStatus` (todos os planos)
- [x] Fila de mensagens com Bull+Redis (evitar flood)

### Critérios de Done
- [x] Cliente recebe mensagem após criar pedido (formato correto)
- [x] Motoboy recebe mensagem com links Maps/Waze corretos
- [x] Cliente recebe mensagem em cada mudança de status
- [x] Mensagens na fila (Bull) processadas em ordem
- [x] Falha no Baileys: log de erro + não quebra o pedido
- [x] Integration: mock de Baileys, verificar mensagens enviadas

---

## TASK-072: WhatsApp — IA Ollama (Plano Premium)

**Epic:** 05-WhatsApp  
**Story:** US-008  
**Estimativa:** 34 pts  
**Dependências:** TASK-071

### Subtasks
- [x] Detectar mensagens incoming no Baileys (dúvidas sobre cardápio)
- [x] Diferenciar: dúvida vs "quero fazer pedido" (prompt de classificação)
- [x] Serviço `OllamaService`:
  - [x] Endpoint RunPod Serverless com API Key
  - [x] Timeout 30s + circuit breaker
  - [x] Fallback: "Aguarde que um atendente vai te responder"
- [x] Contexto do cardápio injetado no prompt (produtos + preços + categorias da loja)
- [x] Resposta para dúvida simples (ingredientes, preços, horários)
- [x] Resposta para item específico: descrição + pergunta "Quer adicionar ao carrinho?"
- [x] Resposta para múltiplos itens/categorias: listar opções + pergunta
- [x] Fluxo de confirmação: detectar "sim" / "pode adicionar" / "pode"
- [x] Gerar hash de carrinho: `/{slug}/carrinho/{hash}` com itens + variações
  - Hash encoda: JSON com `[{ productId, variationId?, qty }]` → base64url
- [x] Enviar link do carrinho pré-montado via WhatsApp
- [x] Se cliente preferir cardápio: enviar link direto `{slug}.${PUBLIC_ROOT_DOMAIN}`
- [x] Feature flag: `whatsappAI` (Plano 2 - Premium)
- [x] Disponível desde o MVP (semanas 9-12)

### Critérios de Done
- [x] IA responde dúvida sobre produto (ingredientes, preços)
- [x] IA oferece adicionar ao carrinho após pergunta específica
- [x] Link de carrinho abre com itens pré-carregados
- [x] Timeout RunPod → fallback enviado em <31s
- [x] Feature flag bloqueia para lojas sem Plano Premium
- [x] Unit: geração/decodificação de hash de carrinho
- [x] Integration: mock RunPod, verificar resposta e link gerado
