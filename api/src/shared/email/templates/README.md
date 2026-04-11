# Templates de E-mail — Menu Panda

Esta pasta contém os templates HTML usados pelo backend para enviar e-mails transacionais.

**Você pode editar livremente cada arquivo `.html` para personalizar o conteúdo, cores, textos e call-to-actions.** As mudanças entram em vigor após reiniciar o serviço (ou sem reiniciar em modo dev com `tsx watch`).

---

## Como funciona

1. Cada arquivo `.html` (exceto `_layout.html`) é um **template de corpo** — só o conteúdo do e-mail.
2. O `_layout.html` é o **layout base** — header (logo Menu Panda em vermelho), footer e estrutura HTML válida para clientes de e-mail (Gmail, Outlook, Apple Mail). Todo template é renderizado dentro do `{{content}}` do layout.
3. Variáveis são interpoladas com sintaxe `{{nomeDaVariavel}}`. As variáveis disponíveis para cada template estão documentadas no comentário no topo de cada arquivo.

---

## Templates disponíveis

| Arquivo | Função do backend | Quando é enviado | Destinatário |
|---|---|---|---|
| `welcome-self-register.html` | `sendWelcomeSelfRegisterEmail()` | Cliente faz auto-cadastro em `/cadastro` (v2.5+) | E-mail informado no cadastro |
| `welcome-owner-created.html` | `sendWelcomeEmail()` | Owner cria uma loja para um cliente (com senha temporária) | E-mail do admin cadastrado pelo Owner |
| `plan-change.html` | `sendPlanChangeEmail()` | Owner altera o plano da loja (upgrade/downgrade) | E-mail do admin da loja |
| `payment-failed.html` | `sendPaymentFailedEmail()` | Webhook Stripe `invoice.payment_failed` | E-mail do admin da loja |
| `trial-suspended.html` | `sendTrialSuspendedEmail()` | Cron `trial-suspension.job` move loja pra `SUSPENDED` (trial expirado ou grace period esgotado) | E-mail do admin da loja |

---

## Variáveis universais (disponíveis em todos os templates)

Além das variáveis específicas de cada template:

| Variável | Descrição |
|---|---|
| `{{currentYear}}` | Ano atual (ex: `2026`) — usado no footer |
| `{{subject}}` | Assunto do e-mail (definido no código) |

---

## Boas práticas ao editar

- **HTML inline-only:** clientes de e-mail (especialmente Gmail e Outlook) ignoram `<style>` blocks e CSS externo. **Use `style="..."` inline em todas as tags.**
- **Tabelas para layout:** estruture com `<table role="presentation">` em vez de `<div>` flexbox/grid — é o padrão da indústria de e-mail.
- **Largura máxima 600px:** o layout base já limita; respeite ao adicionar conteúdo.
- **Imagens externas:** se adicionar `<img>`, use URLs absolutas (`https://...`). Evite Base64 — Outlook bloqueia.
- **Botões CTA:** use `<a>` com `display:inline-block` + `padding` (alguns clientes ignoram `<button>`).
- **Cores:** o vermelho institucional é `#dc2626`. Texto principal `#18181b`, secundário `#52525b`, fundo claro `#fafafa`/`#f4f4f5`.
- **Não remova `{{content}}` do `_layout.html`** — sem ele os e-mails ficam vazios.

---

## Testando localmente

1. Em desenvolvimento, use [MailHog](https://github.com/mailhog/MailHog) ou [Mailpit](https://mailpit.axllent.org/) para capturar e-mails sem enviá-los de fato.
2. Configure as variáveis em `api/.env`:
   ```bash
   SMTP_HOST=localhost
   SMTP_PORT=1025
   ```
3. Acesse `http://localhost:8025` (MailHog) para visualizar.

Em produção (Gmail SMTP), as variáveis são:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=app-password-do-gmail
SMTP_FROM="Menu Panda <seu-email@gmail.com>"
```

> ⚠️ Para Gmail use **App Password** (não a senha da conta). Habilite 2FA em myaccount.google.com → Security → 2-Step Verification → App passwords.
