# Stack geo self-hosted — deploy numa VM GCP

Photon (autocomplete) + Nominatim (geocoding) + OSRM (routing) + Caddy (TLS/proxy)
numa única VM. Implementa o plano em [.local/osm-self-host-stack.v2.md](../../.local/osm-self-host-stack.v2.md),
adaptado pra Google Cloud e usando **Caddy** (consistente com [infra/Caddyfile](../Caddyfile))
em vez de nginx+certbot.

> **Custo importa.** Numa `e2-standard-4` (4 vCPU / 16 GB) o gasto é ~US$ 98/mês.
> Esses recursos são pagos — você cria a VM **manualmente** no console pra
> escolher conscientemente o projeto/billing certo.

---

## Passo 1 — Criar a VM (manual, no console GCP)

Console → Compute Engine → Create instance:

| Campo | Valor sugerido |
|---|---|
| Nome | `geo-osm` |
| Região/zona | `us-central1-a` (ou `southamerica-east1` pra menor latência BR) |
| Machine type | `e2-standard-4` (4 vCPU / 16 GB) — mínimo viável p/ Brazil-only |
| Boot disk | Debian 12, **100 GB SSD** (pd-ssd) |
| Firewall | marcar **Allow HTTP** e **Allow HTTPS** |
| Network tags | `geo` (opcional, pra regra de firewall) |

> Se o import do Nominatim ficar sem RAM, suba temporariamente pra
> `e2-standard-8` (32 GB) só durante o import e volte pra `-4` depois.

**IP externo**: reserve um IP estático (VPC Network → IP addresses) e anexe à VM,
senão o IP muda em cada reboot e quebra o DNS.

**DNS**: crie um registro **A** `geo.menupanda.com.br → <IP externo da VM>`.
(O Caddy usa HTTP-01 challenge, então só precisa do A + portas 80/443 abertas.)

### Comando gcloud equivalente (rode VOCÊ, se preferir CLI)

```bash
gcloud compute instances create geo-osm \
  --project=<SEU_PROJECT_ID> \
  --zone=us-central1-a \
  --machine-type=e2-standard-4 \
  --image-family=debian-12 --image-project=debian-cloud \
  --boot-disk-size=100GB --boot-disk-type=pd-ssd \
  --tags=geo

# Firewall pra 80/443 (uma vez por rede)
gcloud compute firewall-rules create geo-web \
  --project=<SEU_PROJECT_ID> \
  --allow=tcp:80,tcp:443 --target-tags=geo --direction=INGRESS
```

> A porta 22 (SSH) já vem liberada pelo `default-allow-ssh`. **Não** abra
> 2322/8080/5000 — esses ficam internos, só o Caddy (443) é exposto.

---

## Passo 2 — Instalar a stack (dentro da VM)

```bash
# SSH na VM
gcloud compute ssh geo-osm --zone=us-central1-a

# Levar esta pasta pra VM (uma das opções):
#   a) git clone do repo e cd infra/geo
#   b) scp -r infra/geo geo-osm:/opt/geo   (do seu Mac)
sudo mkdir -p /opt/geo && sudo chown $USER /opt/geo
# ...copie os arquivos pra /opt/geo...
cd /opt/geo

cp .env.example .env
nano .env          # GEO_DOMAIN, GEO_API_KEY (openssl rand -hex 32), NOMINATIM_PASSWORD

# Gera a CA + cert de cliente pro mTLS (ver Autenticação abaixo)
bash gen-mtls-certs.sh

sudo bash bootstrap.sh
```

`bootstrap.sh` instala Docker, faz o build do OSRM (Brasil, ~30-60 min) e sobe
todos os containers. O **Nominatim importa o Brasil em background (~horas)** —
acompanhe com `docker compose -p geo logs -f nominatim`. O Photon baixa o dump
pronto no primeiro start.

Pronto quando `docker compose -p geo ps` mostrar os 4 serviços `healthy`.

---

## Passo 3 — Validar

Com mTLS ligado, **todo** request precisa apresentar o cert de cliente
(`--cert`/`--key`) **e** a API key:

```bash
KEY="<o GEO_API_KEY do .env>"
D="https://geo.menupanda.com.br"
C="certs/client.crt"; K="certs/client.key"

curl -s --cert $C --key $K -H "X-API-Key: $KEY" "$D/photon/api?q=avenida+paulista" | head
curl -s --cert $C --key $K -H "X-API-Key: $KEY" "$D/nominatim/search?q=avenida+paulista&format=json" | head
curl -s --cert $C --key $K -H "X-API-Key: $KEY" "$D/osrm/route/v1/driving/-46.6,-23.5;-46.7,-23.6?overview=false"

# Sem o cert, a conexão é RECUSADA no handshake (prova que o mTLS funciona):
curl -s "$D/healthz" ; echo "  ↑ deve falhar com erro de TLS/handshake"
```

---

## Passo 4 — Cron de atualização (opcional, recomendado)

```bash
sudo ln -s /opt/geo/update-osm.sh /etc/cron.weekly/osm-update
```

---

## Passo 5 — Conectar a api Railway

No painel do Railway (env vars do serviço `api`):

```bash
GEO_AUTOCOMPLETE_URL=https://geo.menupanda.com.br/photon
GEO_GEOCODING_URL=https://geo.menupanda.com.br/nominatim
GEO_ROUTING_URL=https://geo.menupanda.com.br/osrm
GEO_API_KEY=<mesma chave do .env da VM>
GEO_USE_OSRM_ROUTING=false        # liga depois de validar (feature flag)

# mTLS — cole o conteúdo base64 (gerado por gen-mtls-certs.sh):
GEO_CLIENT_CERT_B64=<base64 do certs/client.crt>
GEO_CLIENT_KEY_B64=<base64 do certs/client.key>
```

```bash
# Gerar os valores base64 (no seu Mac, dentro de infra/geo):
base64 < certs/client.crt | tr -d '\n'   # → GEO_CLIENT_CERT_B64
base64 < certs/client.key | tr -d '\n'   # → GEO_CLIENT_KEY_B64
```

O módulo backend `api/src/modules/menu/geo/` (Dia 1 do plano) ainda **não**
está implementado — esta pasta entrega só a infra. O molde do cliente mTLS
está em [geo-client.reference.ts](geo-client.reference.ts). Quando quiser, peça
e eu gero o módulo `geo/` completo (providers + fallback + cache Redis).

---

## Autenticação — como só a sua api consegue chamar

Defense-in-depth em duas camadas, ambas server-to-server (o browser do cliente
**nunca** fala direto com o geo — sempre via `/menu/geo/*` na api):

| Camada | O que faz | Onde |
|---|---|---|
| **mTLS** (cert de cliente) | Caddy exige um cert assinado pela nossa CA privada. Sem ele, a conexão morre no **handshake TLS** — antes de qualquer HTTP. Não depende de IP fixo (resolve o egress dinâmico do Railway) e não vaza em log. | [Caddyfile](Caddyfile) `client_auth` + [certs/](certs/) |
| **X-API-Key** | Segunda chave no header, conferida pelo Caddy depois do mTLS. | [Caddyfile](Caddyfile) `@noauth` |

Por que isso fecha o cenário que te preocupava: um atacante teria que possuir
**o certificado de cliente assinado pela sua CA** (que só existe na sua api
Railway, nunca no browser) **e** a API key. Sem o cert, nem chega a mandar um
request. Detalhes de geração/rotação em [certs/README.md](certs/README.md).

---

## Rollback / desligar

```bash
docker compose -p geo down        # para tudo, mantém volumes
docker compose -p geo down -v     # APAGA os dados importados também
```

Pra zerar o custo: **delete a VM** no console (ou `gcloud compute instances
delete geo-osm`). O IP estático reservado continua cobrando até ser liberado.
