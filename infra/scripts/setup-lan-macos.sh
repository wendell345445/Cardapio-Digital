#!/bin/bash
# ─── Super Cardápio — LAN Machine Setup (macOS) ─────────────────────────────
# Configura DNS e instala certificado CA em máquinas macOS na mesma rede.
#
# Uso: ./setup-lan-macos.sh <ip-da-maquina-dev>
# Ex:  ./setup-lan-macos.sh 192.168.0.9
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DEV_IP="${1:?Uso: $0 <ip-da-maquina-dev>  (ex: $0 192.168.0.9)}"

echo "══════════════════════════════════════════════════════"
echo "  Super Cardápio — LAN Setup (macOS)"
echo "══════════════════════════════════════════════════════"
echo ""
echo "  Máquina dev: $DEV_IP"
echo ""

# ─── 1. Configurar DNS resolver ─────────────────────────────────────────────
echo "[1/3] Configurando DNS para .test → $DEV_IP (requer sudo)..."
sudo mkdir -p /etc/resolver
sudo tee /etc/resolver/test > /dev/null <<EOF
nameserver $DEV_IP
port 10053
EOF
echo "       DNS configurado: *.test → $DEV_IP"

# ─── 2. Baixar e instalar certificado CA ────────────────────────────────────
echo "[2/3] Baixando certificado CA..."
CA_TMP="/tmp/supercardapio-rootCA.pem"

if curl -fsSL "http://${DEV_IP}/rootCA.pem" -o "$CA_TMP" 2>/dev/null; then
  echo "       Certificado baixado com sucesso"
else
  echo "       AVISO: Não foi possível baixar via HTTP."
  echo "       Verifique se o docker compose está rodando na máquina dev."
  echo "       Alternativa: copie o arquivo infra/certs/rootCA.pem manualmente."
  echo ""
  read -p "       Caminho do rootCA.pem (ou Enter para pular): " CA_MANUAL
  if [ -n "$CA_MANUAL" ] && [ -f "$CA_MANUAL" ]; then
    cp "$CA_MANUAL" "$CA_TMP"
  else
    echo "       Pulando instalação do certificado."
    CA_TMP=""
  fi
fi

if [ -n "$CA_TMP" ] && [ -f "$CA_TMP" ]; then
  echo "[3/3] Instalando certificado CA..."

  # Tentar via linha de comando (funciona em macOS < Ventura ou com SIP relaxado)
  if sudo security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain \
    "$CA_TMP" 2>/dev/null; then
    rm -f "$CA_TMP"
    echo "       Certificado CA instalado e confiável"
  else
    # Fallback: abrir via Keychain Access (macOS Ventura+ bloqueia o comando acima)
    echo ""
    echo "       ⚠  'security add-trusted-cert' bloqueado (macOS Ventura+/SIP)."
    echo "       Abrindo Keychain Access para instalação manual..."
    echo ""
    echo "       Siga estes passos:"
    echo "       1. No Keychain Access que vai abrir, vá em Arquivo → Importar Itens"
    echo "       2. Selecione: /tmp/supercardapio-rootCA.pem"
    echo "       3. Importe no keychain 'Sistema'"
    echo "       4. Dê duplo clique no certificado importado (mkcert)"
    echo "       5. Expanda 'Confiança' → mude para 'Sempre Confiar'"
    echo "       6. Feche e confirme com a senha do Mac"
    echo ""
    open -a "Keychain Access"
    echo "       Certificado salvo em: $CA_TMP"
    echo "       (Apague depois de importar: rm $CA_TMP)"
  fi
else
  echo "[3/3] Certificado CA não instalado (passo pulado)"
fi

# ─── Verificar ───────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "  Setup concluído!"
echo "══════════════════════════════════════════════════════"
echo ""
echo "  Verificando DNS..."
if dig +short pizzariadonamaria.cardapio.test @"$DEV_IP" -p 10053 2>/dev/null | grep -q .; then
  echo "  ✓ DNS funcionando: pizzariadonamaria.cardapio.test → $(dig +short pizzariadonamaria.cardapio.test @"$DEV_IP" -p 10053)"
else
  echo "  ✗ DNS não respondeu. Verifique se o docker compose está rodando."
fi
echo ""
echo "  URLs disponíveis:"
echo "  https://supercardapio.test          → Owner"
echo "  https://pizzariadonamaria.cardapio.test → Loja A"
echo "  https://burguertop.cardapio.test    → Loja B"
echo "  https://sushiexpress.cardapio.test  → Loja C"
echo ""
