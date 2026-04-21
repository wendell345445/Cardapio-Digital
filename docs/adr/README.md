# Architecture Decision Records (ADRs)

Registros de decisões arquiteturais do projeto **menu-panda / cardápio-whatsapp**.

Um ADR documenta uma decisão técnica com peso — por que foi tomada, quais alternativas foram consideradas, o que muda como consequência. É complementar aos epics (`tasks/epic-*.md`): epic descreve **o que fazer**, ADR descreve **por que decidir assim**.

## Convenções

- **Formato:** Markdown, numeração sequencial (`NNNN-slug-em-kebab-case.md`).
- **Status:** `Proposto` → `Aceito` → (`Substituído por ADR-XXXX` | `Obsoleto`). Atualizar o campo `Status` no topo do arquivo, nunca deletar ADRs aceitos.
- **Escopo:** decisões que afetam múltiplos módulos, padrões de código, infraestrutura, ou tradeoffs de produto com impacto técnico. Mudanças triviais ficam em PR/commit, não em ADR.
- **Template:** use `0001-motoboys-e-blacklist-whitelist-como-itens-standalone-na-sidebar.md` como base (seções: Contexto, Decisão, Alternativas, Consequências, Critérios de aceitação, Referências).

## Index

| # | Título | Status | Data |
|---|--------|--------|------|
| [0001](0001-motoboys-e-blacklist-whitelist-como-itens-standalone-na-sidebar.md) | Motoboys e Blacklist/Whitelist como itens standalone na sidebar | Proposto | 2026-04-21 |
