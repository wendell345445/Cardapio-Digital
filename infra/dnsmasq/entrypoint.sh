#!/bin/sh
set -e

LAN_IP="${LAN_IP:?LAN_IP environment variable is required}"

# Generate dnsmasq config with wildcard DNS for local development
mkdir -p /etc/dnsmasq.d

cat > /etc/dnsmasq.d/supercardapio.conf <<EOF
# Wildcard DNS — all *.cardapio.test and supercardapio.test resolve to dev machine
address=/cardapio.test/${LAN_IP}
address=/supercardapio.test/${LAN_IP}
EOF

cat > /etc/dnsmasq.conf <<EOF
# Upstream DNS (forward non-.test queries)
server=8.8.8.8
server=1.1.1.1

# Do not read /etc/resolv.conf inside container
no-resolv

# Load additional config
conf-dir=/etc/dnsmasq.d/,*.conf

# Log queries (useful for debugging)
log-queries
log-facility=-
EOF

echo "[dnsmasq] Resolving *.cardapio.test → ${LAN_IP}"
echo "[dnsmasq] Resolving supercardapio.test → ${LAN_IP}"
echo "[dnsmasq] Upstream DNS: 8.8.8.8, 1.1.1.1"

exec dnsmasq --no-daemon --log-facility=-
