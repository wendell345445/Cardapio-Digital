#!/usr/bin/env bash
# ─── Bootstrap da VM whatsbot (Ubuntu 24.04 LTS, us-east1, CPU-only) ─────
# Roda DENTRO da VM, depois de você criá-la manualmente no console GCP.
#
#   1. Crie a VM (ver README.md), libere portas 80/443 no firewall.
#   2. Aponte DNS:  whatsbot.menupanda.com.br -> IP externo estático da VM.
#   3. Copie esta pasta infra/whatsbot/ pra VM (scp ou git clone).
#   4. cp .env.example .env && edite os valores (gere WHATSBOT_API_KEY + POSTGRES_PASSWORD).
#   5. bash gen-mtls-certs.sh    (uma única vez)
#   6. sudo bash bootstrap.sh
#
# A primeira execução faz o pull dos modelos (~5 GB de download — leva alguns
# minutos). As próximas restart são instantâneas (modelos em volume).
set -euo pipefail

log() { echo "[$(date +%FT%T)] $*"; }

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
	echo "ERRO: crie o .env primeiro (cp .env.example .env && edite)." >&2
	exit 1
fi

if [[ ! -f certs/ca.crt ]]; then
	echo "ERRO: certs/ca.crt ausente. Rode 'bash gen-mtls-certs.sh' primeiro." >&2
	exit 1
fi

# ── 1. Docker + Compose plugin (Ubuntu 24.04) ─────────────────────────────
if ! command -v docker &>/dev/null; then
	log "Instalando Docker (repo oficial)..."
	apt-get update
	apt-get install -y ca-certificates curl gnupg
	install -m 0755 -d /etc/apt/keyrings
	curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
	chmod a+r /etc/apt/keyrings/docker.gpg
	echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu noble stable" \
		> /etc/apt/sources.list.d/docker.list
	apt-get update
	apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
	systemctl enable --now docker
else
	log "Docker já instalado."
fi

# ── 2. Sobe a stack ───────────────────────────────────────────────────────
# Force o nome do projeto pra 'whatsbot' (volumes ficam prefixados com isso).
log "Subindo containers..."
docker compose -p whatsbot --env-file .env up -d --build

# ── 3. Aguarda Ollama subir e baixa modelos ───────────────────────────────
log "Aguardando Ollama responder..."
for i in {1..30}; do
	if docker exec whatsbot-ollama ollama list &>/dev/null; then break; fi
	sleep 2
done

CHAT_MODEL=$(grep -E '^OLLAMA_CHAT_MODEL=' .env | cut -d= -f2 | tr -d '"')
EMBED_MODEL=$(grep -E '^OLLAMA_EMBED_MODEL=' .env | cut -d= -f2 | tr -d '"')
CHAT_MODEL=${CHAT_MODEL:-llama3:8b}
EMBED_MODEL=${EMBED_MODEL:-nomic-embed-text}

log "Baixando modelo de chat: $CHAT_MODEL (~5 GB, leva alguns minutos)..."
docker exec whatsbot-ollama ollama pull "$CHAT_MODEL"

log "Baixando modelo de embedding: $EMBED_MODEL (~270 MB)..."
docker exec whatsbot-ollama ollama pull "$EMBED_MODEL"

log "Modelos prontos."
log "Status:  docker compose -p whatsbot ps"
log "Logs:    docker compose -p whatsbot logs -f whatsbot-api"
log ""
log "Validar healthz público:    curl https://\$WHATSBOT_DOMAIN/healthz"
log "Validar /ai/* (com mTLS):   ver README.md → seção 'Validar'"
