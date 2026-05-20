#!/bin/bash
# ─── Menu Panda — Sync LAN_IP no .env ────────────────────────────────────────
# Detecta o IP atual da rede local e atualiza LAN_IP no .env raiz.
# Se o IP mudou, recria o container dnsmasq pra refletir o novo valor.
#
# Uso: ./infra/scripts/sync-lan-ip.sh
# Chamado automaticamente por `npm run dev:up`.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

# ─── Detectar LAN IP ─────────────────────────────────────────────────────────
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
if [ -z "$LAN_IP" ]; then
  echo "[sync-lan-ip] ERRO: não foi possível detectar o IP da rede local (en0/en1)."
  echo "                Conecte-se a uma rede Wi-Fi/Ethernet e tente de novo."
  exit 1
fi

# ─── Garantir que .env existe ────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "[sync-lan-ip] .env não encontrado em $ENV_FILE — criando com LAN_IP=$LAN_IP"
  cat > "$ENV_FILE" <<EOF
# ─── LOCAL NETWORK (dnsmasq) ─────────────────────────────────────────────────
# Auto-gerenciado por infra/scripts/sync-lan-ip.sh (rodado por \`npm run dev:up\`).
LAN_IP=$LAN_IP
EOF
  CURRENT_IP=""
else
  CURRENT_IP=$(grep -E "^LAN_IP=" "$ENV_FILE" | head -1 | cut -d'=' -f2 || echo "")
fi

# ─── Sem mudança: nada a fazer ───────────────────────────────────────────────
if [ "$CURRENT_IP" = "$LAN_IP" ]; then
  echo "[sync-lan-ip] LAN_IP já está atualizado: $LAN_IP"
  exit 0
fi

# ─── Atualizar .env ──────────────────────────────────────────────────────────
if grep -qE "^LAN_IP=" "$ENV_FILE"; then
  sed -i '' "s/^LAN_IP=.*/LAN_IP=$LAN_IP/" "$ENV_FILE"
else
  printf '\nLAN_IP=%s\n' "$LAN_IP" >> "$ENV_FILE"
fi
echo "[sync-lan-ip] LAN_IP: $CURRENT_IP → $LAN_IP"

# ─── Recriar dnsmasq se já estiver rodando ───────────────────────────────────
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^menupanda_dns$'; then
  echo "[sync-lan-ip] Recriando container dnsmasq pra aplicar novo IP..."
  (cd "$PROJECT_ROOT" && docker compose up -d --force-recreate dnsmasq)
fi
