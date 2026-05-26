# Certificados mTLS da stack geo

Esta pasta guarda a CA privada e o certificado de cliente que autenticam a
api Railway no endpoint `geo.menupanda.com.br`. **Nenhum `.key`/`.crt` está no
git** (`.gitignore` ignora tudo menos este README e o próprio `.gitignore`).

## Gerar (uma vez)

```bash
cd infra/geo
bash gen-mtls-certs.sh
```

Produz aqui dentro:

| Arquivo | Vai pra onde | Secreto? |
|---|---|---|
| `ca.crt` | VM (montado no Caddy) | não |
| `ca.key` | **guarde OFFLINE** (cofre/1Password), fora da VM | **SIM** |
| `client.crt` | api Railway (env `GEO_CLIENT_CERT_B64`) | não, mas mantenha privado |
| `client.key` | api Railway (env `GEO_CLIENT_KEY_B64`) | **SIM** |

## Como cada lado usa

- **Caddy (VM)**: monta só `ca.crt` e exige `client_auth require_and_verify`.
  Qualquer conexão sem cert assinado por essa CA é recusada no handshake TLS.
- **api Railway**: apresenta `client.crt`+`client.key` via `undici.Agent`
  (ver [../geo-client.reference.ts](../geo-client.reference.ts)).

## Colar no Railway (base64, uma linha cada)

```bash
base64 < client.crt | tr -d '\n'   # → GEO_CLIENT_CERT_B64
base64 < client.key | tr -d '\n'   # → GEO_CLIENT_KEY_B64
```

## Rotação do cert de cliente

Quando o `client.*` se aproximar do vencimento (~2 anos) ou se suspeitar de
vazamento, emita um novo **mantendo a CA**:

```bash
KEEP_CA=1 bash gen-mtls-certs.sh
```

Atualize as env vars no Railway com o novo `client.*`. O `ca.crt` na VM
continua o mesmo — sem mexer no Caddy. Se a **CA** vazar (`ca.key`), aí sim
regenere tudo e troque o `ca.crt` na VM.
