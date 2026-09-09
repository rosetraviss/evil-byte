#!/usr/bin/env bash
# Bootstrap a Debian/Ubuntu VPS to run either side of the evil-byte
# interop test: the MITM + demo server (Sections 5 and 7), or just the
# demo client (Section 8). See deploy/README.md for the full runbook.
#
# Usage (as root):
#   ./setup.sh mitm-server
#   ./setup.sh client
set -euo pipefail

ROLE="${1:?usage: setup.sh mitm-server|client}"
REPO_URL="${REPO_URL:-https://github.com/rosetraviss/evil-byte.git}"
INSTALL_DIR=/opt/evil-byte
GO_VERSION=1.27.0

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root" >&2
  exit 1
fi

apt-get update -qq
apt-get install -y -qq git curl tcpdump
[ "$ROLE" = "mitm-server" ] && apt-get install -y -qq nftables

if ! command -v go >/dev/null 2>&1; then
  ARCH=$(dpkg --print-architecture) # amd64 or arm64
  curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${ARCH}.tar.gz" -o /tmp/go.tar.gz
  rm -rf /usr/local/go
  tar -C /usr/local -xzf /tmp/go.tar.gz
  ln -sf /usr/local/go/bin/go /usr/local/bin/go
fi

rm -rf "$INSTALL_DIR"
git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
cd "$INSTALL_DIR/evil-byte-go"
go build -o /usr/local/bin/evilbyte-mitm ./cmd/mitm
go build -o /usr/local/bin/evilbyte-server ./cmd/server
go build -o /usr/local/bin/evilbyte-client ./cmd/client

case "$ROLE" in
  mitm-server)
    nft delete table inet evil 2>/dev/null || true
    nft -f "$INSTALL_DIR/deploy/evil-mitm.nft"

    install -m644 "$INSTALL_DIR/deploy/evilbyte-mitm.service" /etc/systemd/system/
    install -m644 "$INSTALL_DIR/deploy/evilbyte-server.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable --now evilbyte-mitm.service evilbyte-server.service

    echo
    echo "Server on :8080, MITM active on its outbound responses (NFQUEUE 666)."
    echo "journalctl -u evilbyte-mitm -f    # watch it rate packets"
    echo "journalctl -u evilbyte-server -f  # watch it serve requests"
    ;;
  client)
    echo
    echo "Built /usr/local/bin/evilbyte-client."
    echo "  evilbyte-client -url http://<mitm-server-host>:8080/"
    echo "  sudo tcpdump -i any -v tcp and port 8080   # inspect the arriving TOS byte"
    ;;
  *)
    echo "unknown role: $ROLE (want mitm-server or client)" >&2
    exit 1
    ;;
esac
