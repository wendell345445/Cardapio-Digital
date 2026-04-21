# ADR-0002: Controle de Acesso — permitir adicionar cliente por WhatsApp (sem histórico prévio)

- **Status:** Proposto
- **Data:** 2026-04-21
- **Decisores:** Fabio Dias (tech lead)
- **Relacionado:** ADR-0001 (Motoboys/Controle de Acesso standalone), Epic 04 / TASK-054

---

## Contexto

A página `/admin/controle-de-acesso` (ex-tab Blacklist/Whitelist) hoje lista **apenas** clientes que já fizeram pelo menos um pedido na loja — vem de [payment-access.service.ts:12-42](../../api/src/modules/admin/payment-access.service.ts). Para cada cliente listado há botões `Blacklist`, `Whitelist` e `Remover`.

O endpoint `POST /admin/store/payment-access` exige um `clientId` válido **e** validação de que o cliente tem pedido naquela loja ([payment-access.service.ts:57-63](../../api/src/modules/admin/payment-access.service.ts)):

```ts
if (!hasOrder) {
  throw new AppError('Cliente não possui histórico nessa loja', 422)
}
```

### Problema relatado

> *"Sem opção de incluir e excluir blacklist ou whitelist"*

O usuário (admin da loja) precisa:

1. **Bloquear preventivamente** um WhatsApp que já deu problema em outra loja dele (ou foi denunciado por outro lojista), antes do cliente fazer o primeiro pedido.
2. **Pré-aprovar** (whitelist) um cliente conhecido/VIP antes dele pedir — sem esperar o primeiro pedido para poder liberar pagamento na entrega quando a loja tem `allowCashOnDelivery=false`.

Como o modelo hoje depende de um `Order` existir, **é impossível** fazer qualquer uma dessas duas operações pela UI.

### Estado atual (modelo de dados)

- [User](../../api/prisma/schema.prisma) (`role='CLIENT'`): identificado por `(whatsapp, storeId)` — constraint `@@unique([whatsapp, storeId])`
- [ClientPaymentAccess](../../api/prisma/schema.prisma): `clientId` é FK obrigatória para `User`. Não é possível ter entrada sem um User.
- Cliente público é criado como `User CLIENT` automaticamente no primeiro pedido via menu público.

### Regra de runtime que usa isso

[payment-access.service.ts:134-175](../../api/src/modules/admin/payment-access.service.ts) (`getPaymentMethodsForClient`) consulta `ClientPaymentAccess` por `(storeId, clientId)`. Ou seja: precisa de um `clientId`. No checkout, esse `clientId` vem do User reconhecido por WhatsApp.

---

## Decisão

**Permitir ao admin adicionar um cliente ao Controle de Acesso informando `whatsapp + nome + tipo`, criando ou reutilizando um `User CLIENT` da loja como efeito colateral.**

Concretamente:

1. Novo endpoint `POST /admin/store/payment-access/by-whatsapp` aceitando:
   ```json
   { "whatsapp": "5511999999999", "name": "Nome opcional", "type": "BLACKLIST" | "WHITELIST" }
   ```
2. Service `addPaymentAccessByWhatsapp(storeId, data, userId, ip)`:
   - Busca User por `(whatsapp, storeId)` com `role='CLIENT'`.
   - Se **não existe:** cria um User CLIENT novo com `whatsapp`, `name` (fallback "Cliente <últimos 4 dígitos>"), `storeId`, **sem email, sem senha** (`passwordHash=null`, `isActive=true`). Esse User só existe para ancorar a classificação — não autentica, não recebe tokens.
   - Se **existe:** reutiliza o clientId.
   - Chama a mesma lógica de `addPaymentAccess` (deleta entrada anterior + cria nova + audit log), mas **pula** a validação de `hasOrder`.
3. Endpoint de remoção (`DELETE /admin/store/payment-access/:clientId`) continua o mesmo — já cobre tanto clientes com histórico quanto os criados manualmente.
4. UI: na [ControleAcessoPage.tsx](../../web/src/modules/admin/pages/ControleAcessoPage.tsx), adicionar form no topo:
   - Nome (opcional)
   - WhatsApp (obrigatório, normalizado)
   - Tipo (radio: Blacklist / Whitelist)
   - Botão "Adicionar"
5. A listagem continua mostrando "clientes com histórico" + os criados manualmente (que também passam a ter `ClientPaymentAccess`, então já aparecem).

### Por que não quebrar a restrição `hasOrder` no endpoint existente

Poderíamos simplesmente remover o `if (!hasOrder)` do endpoint atual e aceitar `clientId` arbitrário. **Não fazemos isso porque:**

- A UI admin não tem "criar User avulso" — precisaria de um endpoint de criação separado mesmo.
- Misturar os dois fluxos num só endpoint complica a validação (o que é erro do frontend vs. operação legítima?).
- Separar `POST /payment-access` (clientes existentes) de `POST /payment-access/by-whatsapp` (entrada por WhatsApp) deixa a intenção clara e mantém compat retroativa.

### Por que criar User "vazio" em vez de um novo modelo

Alternativa: criar um modelo `BlacklistedWhatsapp { storeId, whatsapp, type }` separado de `ClientPaymentAccess`.

- **Contras:** duplica a regra de lookup em `getPaymentMethodsForClient` (hoje faz 1 query, passaria a fazer 2: por clientId **ou** por whatsapp). Aumenta superfície de bug (dois lugares pra manter consistentes — e se o cliente criar conta depois do manual add?).
- **Prós:** User "fantasma" sem email/senha é um pouco estranho.
- **Decisão:** User vazio é aceitável. Ele *não é* fantasma — é exatamente o mesmo User que seria criado no primeiro pedido, só que antecipado. Se o cliente pedir depois, o lookup `findFirst({ whatsapp, storeId })` no fluxo do menu público vai achar o mesmo registro e populará os campos que faltam (name se vier, etc.).

---

## Alternativas consideradas

### A) Não fazer nada (manter restrição atual)

- **Prós:** zero código.
- **Contras:** feature pedida não existe. Admin não consegue blacklist preventivo nem whitelist de VIP antes do primeiro pedido.
- **Descartada:** problema é real.

### B) Remover `hasOrder` do endpoint atual + criar User no frontend

- Admin teria que primeiro cadastrar o cliente (endpoint novo, `POST /admin/clients`?), pegar o id, depois classificar.
- **Contras:** dois cliques pra uma tarefa só; endpoint admin de criação de cliente não existe e abre outras decisões (qual a UI dele? onde fica?).
- **Descartada:** complica UX sem ganho.

### C) Modelo `BlacklistedWhatsapp` separado

- Ver seção "Por que criar User vazio" acima.
- **Descartada:** divergência de modelo não paga.

### D) Aceitar CSV / upload em massa

- Admin cola 20 WhatsApps, sistema bloqueia todos.
- **Prós:** útil quando a migração for de outra ferramenta.
- **Contras:** escopo maior, mais validação, não é o que foi pedido.
- **Follow-up:** fica listado como FU-2 caso surja demanda.

---

## Consequências

### Positivas

- Admin resolve o caso de uso imediato (classificar WhatsApp sem histórico).
- Modelo runtime (`getPaymentMethodsForClient`) não muda — mesma query, mesmas regras.
- Quando cliente manualmente classificado pedir pela primeira vez, o User já existe e a classificação vale "como sempre valeu" — sem caminho especial.

### Neutras / Trade-offs

- Passamos a criar `User CLIENT` sem email/senha/orders. Isso já acontece em testes e o schema aceita. Nenhum campo NOT NULL conflita.
- Aumenta ligeiramente o volume da tabela `User` se o admin blacklist-ar muitos WhatsApps preventivamente. Insignificante pro porte esperado.

### Negativas / Riscos

- **Colisão com cliente real futuro**: se admin cadastrar "5511999999999" como BLACKLIST com nome genérico, e depois um cliente real com esse WhatsApp pedir, ele tá blacklisted (comportamento esperado). Se o admin cadastrar errado o número, o cliente legítimo fica bloqueado — mas isso é exatamente o que blacklist faz, não é bug. A UI vai destacar o número e o nome na confirmação para reduzir esse risco.
- **Auditoria**: o `AuditLog` registrará a ação, incluindo se o User foi criado ou reutilizado. Já vai no `data` JSON.
- **Validação de WhatsApp**: hoje não há validador forte de formato. O schema Zod vai normalizar (`trim`, só dígitos, mín. 10) — mas aceitar números "estranhos" não é catástrofe.

### Follow-ups (não bloqueantes)

- **FU-1:** expor filtro/busca na listagem (crescendo a tabela, vira ruim).
- **FU-2:** import de lista CSV (quando/se houver demanda).
- **FU-3:** mostrar "criado manualmente" vs. "pediu antes" como coluna/badge — útil pra revisão do admin.

---

## Critérios de aceitação

### Backend

- [ ] `POST /admin/store/payment-access/by-whatsapp` responde 200/201 com `{ clientId, accessId, type }`
- [ ] Cria User CLIENT se não existir; reutiliza se existir (lookup por `whatsapp + storeId`)
- [ ] Funciona mesmo sem `Order` prévio (sem `hasOrder` check)
- [ ] Deleta entrada anterior no mesmo `(storeId, clientId)` antes de criar (mantém unicidade de tipo)
- [ ] Grava `AuditLog` com `action='store.payment-access.add-by-whatsapp'` e `data={ whatsapp, name, type, createdNewUser: boolean }`
- [ ] Zod: `whatsapp` obrigatório (só dígitos, ≥10), `name` opcional (trim, max 100), `type` enum
- [ ] Unit test: cria User novo; reutiliza User existente; substitui classificação anterior
- [ ] Integration test: rota com auth + multi-tenant isolado

### Frontend

- [ ] `ControleAcessoPage` tem form no topo (Nome opcional, WhatsApp*, Tipo radio, botão Adicionar)
- [ ] Ao adicionar, invalida query `storeClients` e o item aparece na lista
- [ ] Toast de sucesso/erro
- [ ] Hook `useAddPaymentAccessByWhatsapp` exportado do `usePaymentAccess.ts`
- [ ] Validação client-side de WhatsApp (mín. 10 dígitos)

### DoD

- [ ] `npm run lint -w api` e `-w web`: 0 errors
- [ ] `npm run typecheck -w api` e `-w web`: clean
- [ ] `npx jest payment-access --runInBand -w api`: passa
- [ ] `npm test -w web`: passa
