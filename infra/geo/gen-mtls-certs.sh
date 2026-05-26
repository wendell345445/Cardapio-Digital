#!/usr/bin/env bash
# ─── Gera CA privada + certificado de cliente para mTLS ───────────────────
# Rode UMA VEZ (na sua máquina ou na VM). Produz:
#
#   certs/ca.crt        → CA pública. Vai pro Caddy (valida clientes).
#   certs/ca.key        → CHAVE da CA. GUARDE OFFLINE. Não vai pra lugar nenhum.
#   certs/client.crt    → cert do cliente. Vai pra api Railway.
#   certs/client.key    → chave do cliente. Vai pra api Railway (secreta).
#
# A api Railway apresenta client.crt+client.key em toda chamada ao geo.
# O Caddy só aceita conexões cujo cert de cliente foi assinado por ca.crt.
#
# Rotação: re-rode com KEEP_CA=1 pra emitir um novo client.* mantendo a CA.
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p certs
cd certs

DAYS_CA=3650      # CA vale 10 anos
DAYS_CLIENT=825   # cert de cliente vale ~2 anos (rotacione antes)
CLIENT_CN="menupanda-api"

# ── CA ──────────────────────────────────────────────────────────────────
if [[ "${KEEP_CA:-0}" == "1" && -f ca.crt && -f ca.key ]]; then
	echo "Mantendo CA existente (KEEP_CA=1)."
else
	echo "Gerando CA privada..."
	openssl genrsa -out ca.key 4096
	openssl req -x509 -new -nodes -key ca.key -sha256 -days "$DAYS_CA" \
		-subj "/CN=menupanda-geo-CA/O=Menu Panda" -out ca.crt
fi

# ── Cert de cliente ───────────────────────────────────────────────────────
echo "Gerando certificado de cliente ($CLIENT_CN)..."
openssl genrsa -out client.key 2048
openssl req -new -key client.key -subj "/CN=$CLIENT_CN/O=Menu Panda" -out client.csr
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
	-days "$DAYS_CLIENT" -sha256 \
	-extfile <(printf "extendedKeyUsage=clientAuth") \
	-out client.crt
rm -f client.csr

chmod 600 ca.key client.key

echo ""
echo "✅ Gerado em $(pwd):"
echo "   ca.crt      → fica na VM, montado no Caddy (NÃO é secreto)"
echo "   ca.key      → GUARDE OFFLINE, fora da VM e fora do git"
echo "   client.crt  → vai pra api Railway (env GEO_CLIENT_CERT)"
echo "   client.key  → vai pra api Railway (env GEO_CLIENT_KEY) — SECRETO"
echo ""
echo "Para colar nas env vars do Railway (base64, uma linha):"
echo "   GEO_CLIENT_CERT_B64=\$(base64 < certs/client.crt)"
echo "   GEO_CLIENT_KEY_B64=\$(base64 < certs/client.key)"
echo "   GEO_CA_CERT_B64=\$(base64 < certs/ca.crt)   # opcional p/ pin server"
