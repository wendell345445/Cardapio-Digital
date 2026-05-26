#!/usr/bin/env bash
# ─── Bootstrap da VM geo (Debian 12 / Ubuntu 22.04) ──────────────────────
# Roda DENTRO da VM, depois de você criá-la manualmente no console GCP.
#
#   1. Crie a VM (ver README.md), libere portas 80/443 no firewall.
#   2. Aponte DNS:  geo.<seu-dominio>  ->  IP externo da VM.
#   3. Copie esta pasta infra/geo/ pra VM (scp ou git clone).
#   4. cp .env.example .env && edite os valores.
#   5. sudo bash bootstrap.sh
#
# O passo pesado é o import do OSRM (extract/partition/customize do Brasil),
# que roda aqui mesmo. O Nominatim importa sozinho ao subir (~horas) e o
# Photon baixa o dump pronto da GraphHopper no primeiro start.
set -euo pipefail

log() { echo "[$(date +%FT%T)] $*"; }

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
	echo "ERRO: crie o .env primeiro (cp .env.example .env && edite)." >&2
	exit 1
fi

# ── 1. Docker + Compose ───────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
	log "Instalando Docker..."
	curl -fsSL https://get.docker.com | sh
	systemctl enable --now docker
else
	log "Docker já instalado."
fi

# ── 2. Build do OSRM (Brazil) ─────────────────────────────────────────────
# Cria o volume osrm_data e processa o .pbf nele. Pesado em RAM/CPU; numa
# e2-standard-4 (16 GB) o Brasil cabe. Se faltar RAM no osrm-partition,
# subir a VM temporariamente ou usar swap.
OSRM_VOL="geo_osrm_data"
PBF_URL="https://download.geofabrik.de/south-america/brazil-latest.osm.pbf"

if ! docker volume inspect "$OSRM_VOL" &>/dev/null; then
	log "Criando volume $OSRM_VOL e baixando .pbf do Brasil..."
	docker volume create "$OSRM_VOL"
	docker run --rm -v "$OSRM_VOL":/data alpine sh -c \
		"apk add --no-cache wget >/dev/null && wget -q -O /data/brazil-latest.osm.pbf '$PBF_URL'"

	log "OSRM extract (pode levar ~30-60 min)..."
	docker run --rm -v "$OSRM_VOL":/data osrm/osrm-backend \
		osrm-extract -p /opt/car.lua /data/brazil-latest.osm.pbf
	log "OSRM partition..."
	docker run --rm -v "$OSRM_VOL":/data osrm/osrm-backend \
		osrm-partition /data/brazil-latest.osrm
	log "OSRM customize..."
	docker run --rm -v "$OSRM_VOL":/data osrm/osrm-backend \
		osrm-customize /data/brazil-latest.osrm
	log "OSRM pronto."
else
	log "Volume OSRM já existe, pulando build."
fi

# ── 3. Sobe a stack ───────────────────────────────────────────────────────
# O nome do volume externo do compose é prefixado pelo nome do projeto
# (pasta). Forçamos o nome do projeto pra 'geo' pra casar com OSRM_VOL.
log "Subindo containers (Nominatim vai importar em background, ~horas)..."
docker compose -p geo --env-file .env up -d

log "Pronto. Acompanhe o import do Nominatim:"
log "  docker compose -p geo logs -f nominatim"
log "Quando todos estiverem healthy:  docker compose -p geo ps"
