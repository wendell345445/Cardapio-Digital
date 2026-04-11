# Certificados Locais (mkcert) + DNS (dnsmasq)

O ambiente local usa **dnsmasq** (Docker) para DNS wildcard e **mkcert** para HTTPS confiável.

## Setup Rápido (máquina dev)

```bash
./infra/scripts/setup-dev.sh
docker compose up -d
```

O script faz tudo automaticamente:
- Detecta seu IP na rede local
- Instala mkcert e gera certificados (se necessário)
- Copia o CA root para distribuição LAN
- Configura `/etc/resolver/test` para DNS wildcard

## Como funciona

```
Browser → DNS (dnsmasq :10053) → resolve *.cardapio.test → seu IP LAN
       → Caddy (:443) → TLS com mkcert cert → proxy para Vite/API
```

- **dnsmasq** resolve `*.cardapio.test` e `supercardapio.test` para o IP da máquina dev
- **Caddy** faz TLS termination com o certificado wildcard do mkcert
- **Sem `/etc/hosts`** — novas lojas funcionam automaticamente pelo slug

## Certificados gerados

Estes arquivos são gerados localmente e **NÃO estão no repositório** (`.gitignore`):

| Arquivo | Descrição |
|---------|-----------|
| `_wildcard.cardapio.test+2.pem` | Certificado TLS (wildcard) |
| `_wildcard.cardapio.test+2-key.pem` | Chave privada |
| `rootCA.pem` | CA root (para distribuir a outras máquinas) |

## Regenerar certificados manualmente

```bash
brew install mkcert
mkcert -install
cd infra/certs
mkcert "*.cardapio.test" cardapio.test supercardapio.test
cp "$(mkcert -CAROOT)/rootCA.pem" .
```

## Domínios disponíveis após setup

| URL | Papel |
|-----|-------|
| `https://cardapio.test` | Owner / Admin global |
| `https://pizzariadonamaria.cardapio.test` | Loja A (Professional) |
| `https://burguertop.cardapio.test` | Loja B (Premium) |
| `https://sushiexpress.cardapio.test` | Loja C (Suspensa) |
| `https://supercardapio.test` | Loja com domínio próprio |
| `https://<qualquer-slug>.cardapio.test` | Qualquer loja pelo slug |

> O certificado wildcard `*.cardapio.test` cobre todos os subdomínios.
> Para novas lojas, basta criar no admin — sem configuração extra.

## Acesso LAN (outras máquinas)

### macOS
```bash
./infra/scripts/setup-lan-macos.sh 192.168.0.9
```

### iOS / Android
Veja: `infra/scripts/setup-lan-mobile.md`

### Windows / Linux
1. Configurar DNS do sistema para apontar para `192.168.0.9` porta `10053`
2. Baixar e instalar o CA: `http://cardapio.test/rootCA.pem`

## Troubleshooting

**DNS não resolve:**
```bash
dig @127.0.0.1 -p 10053 pizzariadonamaria.cardapio.test
docker compose logs dnsmasq
```

**Conflito na porta 53:**
O dnsmasq usa porta 10053 localmente (evita conflito com mDNSResponder).
Para LAN, usa porta 53 padrão no IP da rede.

**IP da rede mudou:**
```bash
./infra/scripts/setup-dev.sh   # re-detecta o IP
docker compose restart dnsmasq
```
