#!/usr/bin/env bash
# ─── Atualização semanal dos dados OSM ───────────────────────────────────
# Instalar como cron:
#   sudo ln -s /opt/geo/update-osm.sh /etc/cron.weekly/osm-update
# (ou crontab -e:  15 4 * * 0  /opt/geo/update-osm.sh >> /var/log/osm-update.log 2>&1)
#
# - Nominatim: replication diária roda sozinho no container, nada a fazer.
# - Photon: rebuild trocando o dump pronto.
# - OSRM: re-extract/partition/customize do .pbf novo.
set -euo pipefail

log() { echo "[$(date +%FT%T)] $*"; }
cd "$(dirname "$0")"

OSRM_VOL="geo_osrm_data"
PHOTON_VOL="geo_photon_data"
PBF_URL="https://download.geofabrik.de/south-america/brazil-latest.osm.pbf"
PHOTON_DB="https://download1.graphhopper.com/public/photon-db-latest.tar.bz2"

# ── Photon ────────────────────────────────────────────────────────────────
log "Atualizando Photon..."
docker compose -p geo stop photon
docker run --rm -v "$PHOTON_VOL":/photon/photon_data alpine sh -c \
	"apk add --no-cache wget bzip2 tar >/dev/null && \
	 cd /photon/photon_data && wget -q -O - '$PHOTON_DB' | tar -xj"
docker compose -p geo start photon
log "Photon atualizado."

# ── OSRM ──────────────────────────────────────────────────────────────────
log "Atualizando OSRM..."
docker run --rm -v "$OSRM_VOL":/data alpine sh -c \
	"apk add --no-cache wget >/dev/null && wget -q -O /data/brazil-latest.osm.pbf '$PBF_URL'"
docker run --rm -v "$OSRM_VOL":/data osrm/osrm-backend osrm-extract -p /opt/car.lua /data/brazil-latest.osm.pbf
docker run --rm -v "$OSRM_VOL":/data osrm/osrm-backend osrm-partition /data/brazil-latest.osrm
docker run --rm -v "$OSRM_VOL":/data osrm/osrm-backend osrm-customize /data/brazil-latest.osrm
docker compose -p geo restart osrm
log "OSRM atualizado."

log "Tudo OK."
