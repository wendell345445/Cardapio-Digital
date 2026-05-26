# Stack whatsbot AI — deploy numa VM GCP (CPU-only)

Ollama (chat + embeddings) + Postgres pgvector + Node.js (Fastify) + Caddy
(TLS/proxy mTLS) numa única VM Ubuntu 24.04 LTS. Atende `POST /ai/answer` pra
api Railway, aplica RAG por cliente×loja e responde com IA informativa.

> **Custo importa.** Numa `e2-standard-4` (4 vCPU / 16 GB) em `us-east1` o
> gasto fica em torno de US$ 120/mês (VM + 100 GB SSD + IP estático). A VM
> é paga — você cria **manualmente** no console pra escolher conscientemente
> o projeto/billing certo.

GCP project: **MenuPanda** (`menupanda-494718`).

---

## Passo 1 — Criar a VM (manual, no console GCP)

Console → Compute Engine → Create instance:

| Campo | Valor |
|---|---|
| Project | `menupanda-494718` (MenuPanda) |
| Nome | `whatsbot` |
| Região / zona | `us-east1` / `us-east1-c` |
| Machine type | `e2-standard-4` (4 vCPU / 16 GB) |
| Boot disk | **Ubuntu 24.04 LTS**, **100 GB SSD** (pd-ssd) |
| Firewall | marcar **Allow HTTP** e **Allow HTTPS** |
| Network tags | `whatsbot` (opcional) |

**IP externo (já reservado)**: `34.26.174.109` — anexado à VM `whatsbot` (2026-05-26).

**DNS**: crie um registro **A** `whatsbot.menupanda.com.br → 34.26.174.109`.
O Caddy usa HTTP-01 challenge, então só precisa do A + portas 80/443 abertas.

**Política de snapshot**: Compute Engine → Snapshots → Snapshot schedules → crie
política diária (retenção 7 dias) e anexe ao disco da VM. Backup automático.

### Comando gcloud equivalente

```bash
gcloud compute instances create whatsbot \
  --project=menupanda-494718 \
  --zone=us-east1-c \
  --machine-type=e2-standard-4 \
  --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud \
  --boot-disk-size=100GB --boot-disk-type=pd-ssd \
  --tags=whatsbot

# Firewall (uma vez por rede)
gcloud compute firewall-rules create whatsbot-web \
  --project=menupanda-494718 \
  --allow=tcp:80,tcp:443 --target-tags=whatsbot --direction=INGRESS
```

---

## Passo 2 — Instalar a stack (dentro da VM)

```bash
# SSH na VM
gcloud compute ssh whatsbot --zone=us-east1-c --project=menupanda-494718

# Levar esta pasta pra VM (uma das opções):
#   a) git clone do repo e cd infra/whatsbot
#   b) scp -r infra/whatsbot whatsbot:/opt/whatsbot   (do seu Mac)
sudo mkdir -p /opt/whatsbot && sudo chown $USER /opt/whatsbot
# ...copie os arquivos pra /opt/whatsbot...
cd /opt/whatsbot

cp .env.example .env
nano .env          # WHATSBOT_DOMAIN, WHATSBOT_API_KEY (openssl rand -hex 32), POSTGRES_PASSWORD

bash gen-mtls-certs.sh     # gera CA + cert de cliente

sudo bash bootstrap.sh     # instala Docker, sobe stack, baixa modelos (~5 GB)
```

`bootstrap.sh` instala Docker, faz `docker compose up -d --build` e baixa
os modelos `llama3:8b` (~5 GB) e `nomic-embed-text` (~270 MB) dentro do
container Ollama. O primeiro start leva alguns minutos; restarts subsequentes
são instantâneos (modelos persistidos em volume).

Pronto quando `docker compose -p whatsbot ps` mostrar os 4 serviços `healthy`.

---

## Passo 3 — Validar

Com mTLS ligado, **todo** request precisa apresentar o cert de cliente
(`--cert`/`--key`) **e** a API key:

```bash
KEY="<o WHATSBOT_API_KEY do .env>"
D="https://whatsbot.menupanda.com.br"
C="certs/client.crt"; K="certs/client.key"

# Healthz é público (sem cert, sem key):
curl -s "$D/healthz"            # ok

# Endpoint protegido:
curl -s --cert $C --key $K -H "X-Api-Key: $KEY" \
  -X POST "$D/ai/answer" \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "11111111-1111-4111-8111-111111111111",
    "customerPhone": "5511999999999",
    "message": "tem coca cola diet?",
    "context": {
      "store": {
        "name": "Burger Top",
        "slug": "burgertop",
        "menuUrl": "https://burgertop.menupanda.com.br"
      },
      "menu": "== Bebidas ==\n- Coca-Cola Diet R$ 8,00"
    }
  }'

# Sem cert → handshake recusado:
curl -sk "$D/ai/answer"   # falha com erro de TLS/handshake
```

---

## Passo 4 — Conectar a api Railway

No painel do Railway (env vars do serviço `api`):

```bash
WHATSBOT_URL=https://whatsbot.menupanda.com.br
WHATSBOT_API_KEY=<mesma chave do .env da VM>

# mTLS — cole o base64 (gerado por gen-mtls-certs.sh):
WHATSBOT_CLIENT_CERT_B64=<base64 do certs/client.crt>
WHATSBOT_CLIENT_KEY_B64=<base64 do certs/client.key>
```

```bash
# Gerar os valores base64 (no seu Mac ou na VM, dentro de infra/whatsbot):
base64 < certs/client.crt | tr -d '\n'   # → WHATSBOT_CLIENT_CERT_B64
base64 < certs/client.key | tr -d '\n'   # → WHATSBOT_CLIENT_KEY_B64
```

---

## Autenticação — como só a sua api consegue chamar

Defense-in-depth em duas camadas, ambas server-to-server (o browser do cliente
**nunca** fala direto com o whatsbot — sempre via api Railway):

| Camada | O que faz | Onde |
|---|---|---|
| **mTLS** (cert de cliente) | Caddy exige um cert assinado pela nossa CA privada. Sem ele, a conexão morre no **handshake TLS** — antes de qualquer HTTP. | [Caddyfile](Caddyfile) `client_auth` |
| **X-API-Key** | Segunda chave no header, conferida pelo Caddy depois do mTLS. | [Caddyfile](Caddyfile) `@noauth` |

---

## Rollback / desligar

```bash
docker compose -p whatsbot down        # para tudo, mantém volumes (memória preservada)
docker compose -p whatsbot down -v     # APAGA dados (memória, modelos, certs Caddy)
```

Pra zerar o custo: **delete a VM** no console (ou
`gcloud compute instances delete whatsbot --project=menupanda-494718 --zone=us-east1-c`).
O IP estático reservado continua cobrando até ser liberado.
