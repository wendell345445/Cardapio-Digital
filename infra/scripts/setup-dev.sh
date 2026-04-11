#!/bin/bash
# ─── Menu Panda — Dev Environment Setup ──────────────────────────────────
# Configura DNS local (dnsmasq), certificados TLS (mkcert) e rede LAN.
# Executar UMA VEZ na máquina de desenvolvimento.
#
# Uso: ./infra/scripts/setup-dev.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CERT_DIR="$PROJECT_ROOT/infra/certs"

echo "══════════════════════════════════════════════════════"
echo "  Menu Panda — Dev Environment Setup"
echo "══════════════════════════════════════════════════════"
echo ""

# ─── 1. Detectar LAN IP ─────────────────────────────────────────────────────
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
if [ -z "$LAN_IP" ]; then
  echo "ERRO: Não foi possível detectar o IP da rede local."
  echo "Defina LAN_IP manualmente no .env"
  exit 1
fi
echo "[1/7] LAN IP detectado: $LAN_IP"

# ─── 2. Escrever LAN_IP no .env ─────────────────────────────────────────────
ENV_FILE="$PROJECT_ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: .env não encontrado. Copie o .env.example primeiro."
  exit 1
fi

if grep -q "^LAN_IP=" "$ENV_FILE" 2>/dev/null; then
  sed -i '' "s/^LAN_IP=.*/LAN_IP=$LAN_IP/" "$ENV_FILE"
  echo "[2/7] LAN_IP atualizado no .env"
else
  cat >> "$ENV_FILE" <<EOF

# ─── LOCAL NETWORK (dnsmasq) ─────────────────────────────────────────────────
# LAN IP da máquina dev (auto-detectado por infra/scripts/setup-dev.sh)
# Usado pelo dnsmasq para resolver *.cardapio.test na rede local
LAN_IP=$LAN_IP
EOF
  echo "[2/7] LAN_IP adicionado ao .env"
fi

# ─── 3. Instalar mkcert se necessário ───────────────────────────────────────
if ! command -v mkcert &>/dev/null; then
  echo "[3/7] Instalando mkcert..."
  brew install mkcert
else
  echo "[3/7] mkcert já instalado"
fi
mkcert -install 2>/dev/null || true

# ─── 4. Gerar certificados TLS se ausentes ──────────────────────────────────
if [ ! -f "$CERT_DIR/_wildcard.cardapio.test+2.pem" ]; then
  echo "[4/7] Gerando certificados TLS..."
  cd "$CERT_DIR"
  mkcert "*.cardapio.test" cardapio.test supercardapio.test
  cd "$PROJECT_ROOT"
else
  echo "[4/7] Certificados TLS já existem"
fi

# ─── 5. Copiar CA root para distribuição LAN ────────────────────────────────
CA_ROOT="$(mkcert -CAROOT)/rootCA.pem"
if [ -f "$CA_ROOT" ]; then
  cp "$CA_ROOT" "$CERT_DIR/rootCA.pem"
  echo "[5/7] CA root copiado para infra/certs/rootCA.pem"
else
  echo "[5/7] AVISO: CA root não encontrado em $CA_ROOT"
fi

# ─── 6. Configurar macOS resolver para .test TLD ────────────────────────────
RESOLVER_FILE="/etc/resolver/test"
if [ ! -f "$RESOLVER_FILE" ]; then
  echo "[6/7] Criando /etc/resolver/test (requer sudo)..."
  sudo mkdir -p /etc/resolver
  sudo tee "$RESOLVER_FILE" > /dev/null <<EOF
nameserver 127.0.0.1
port 10053
EOF
  echo "       macOS resolver configurado para .test TLD"
else
  echo "[6/7] /etc/resolver/test já existe"
  echo "       Conteúdo atual:"
  cat "$RESOLVER_FILE" | sed 's/^/       /'
fi

# ─── 7. Verificar conflitos ─────────────────────────────────────────────────
echo "[7/7] Verificando conflitos..."

# Entradas antigas no /etc/hosts
if grep -q "cardapio.test" /etc/hosts 2>/dev/null; then
  echo ""
  echo "  ⚠  ATENÇÃO: Encontradas entradas cardapio.test no /etc/hosts."
  echo "     Essas entradas podem conflitar com o dnsmasq."
  echo "     Remova as seguintes linhas do /etc/hosts:"
  echo ""
  grep "cardapio.test" /etc/hosts | sed 's/^/     /'
  echo ""
fi

# Porta 53 em uso
if lsof -i :53 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
  echo "  ⚠  ATENÇÃO: Porta 53 já em uso (pode ser mDNSResponder)."
  echo "     O dnsmasq usa porta 10053 localmente para evitar conflito."
fi

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Setup concluído!"
echo "══════════════════════════════════════════════════════"
echo ""
echo "  Próximos passos:"
echo "  1. Remova entradas cardapio.test do /etc/hosts (se avisado acima)"
echo "  2. Execute: docker compose up -d"
echo "  3. Teste:   dig @127.0.0.1 -p 10053 pizzariadonamaria.cardapio.test"
echo "  4. Abra:    https://pizzariadonamaria.cardapio.test"
echo ""
echo "  Para acesso LAN de outras máquinas:"
echo "  IP do dev: $LAN_IP"
echo "  CA cert:   http://cardapio.test/rootCA.pem"
echo "  Script:    ./infra/scripts/setup-lan-macos.sh $LAN_IP"
echo ""
