#!/usr/bin/env bash
# html-to-img server helper for Coolify.
#
# Download and run on the server (as root or with sudo):
#   curl -fsSL https://raw.githubusercontent.com/freack21/html-to-img/main/deploy/coolify/setup.sh -o setup.sh
#   sudo bash setup.sh check     # read-only: is this server ready for Coolify?
#   sudo bash setup.sh install   # check, then install Coolify with the official script
#   sudo bash setup.sh deploy    # create + deploy html-to-img through the Coolify API
#
# Options: --branch <git branch> (default: main), --yes (skip confirmations)
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/freack21/html-to-img"
BRANCH="main"
ASSUME_YES=0
COMMAND="${1:-help}"
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --branch) BRANCH="$2"; shift 2 ;;
    --yes) ASSUME_YES=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; WARNINGS=$((WARNINGS + 1)); }
fail() { printf '  \033[31m✘\033[0m %s\n' "$*"; BLOCKERS=$((BLOCKERS + 1)); }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
WARNINGS=0
BLOCKERS=0

confirm() {
  [ "$ASSUME_YES" = 1 ] && return 0
  read -r -p "$1 [y/N] " answer </dev/tty
  [[ "$answer" =~ ^[Yy]$ ]]
}

require_root() {
  [ "$(id -u)" -eq 0 ] || die "Run this with sudo: sudo bash $0 $COMMAND"
}

public_ip() {
  curl -fsS4 --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'
}

coolify_installed() {
  [ -d /data/coolify/source ] && command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx coolify
}

# Prints the process name(s) listening on a TCP port ("unknown process" if they can't be
# identified), or nothing when the port is free.
port_owner() {
  if command -v ss >/dev/null 2>&1; then
    local lines names
    lines=$(ss -H -ltnp "sport = :$1" 2>/dev/null || true)
    [ -n "$lines" ] || return 0
    names=$(printf '%s\n' "$lines" | { grep -o 'users:(("[^"]*"' || true; } | sed 's/users:(("//; s/"$//' | sort -u | paste -sd, -)
    printf '%s' "${names:-unknown process}"
  elif (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; then
    printf 'unknown process'
  fi
}

check() {
  bold "Checking this server for Coolify + html-to-img"

  # shellcheck disable=SC1091
  . /etc/os-release 2>/dev/null || true
  case "${ID:-}" in
    ubuntu | debian) ok "OS: ${PRETTY_NAME:-$ID}" ;;
    *) warn "OS: ${PRETTY_NAME:-unknown}. Coolify officially targets Debian/Ubuntu-based servers; other distros may need a manual Docker install." ;;
  esac
  if [ "${ID:-}" = ubuntu ] && [[ "${VERSION:-}" != *LTS* ]]; then
    warn "Ubuntu ${VERSION_ID:-} is not an LTS release; Coolify recommends LTS (22.04 / 24.04)."
  fi

  case "$(uname -m)" in
    x86_64 | aarch64) ok "Architecture: $(uname -m)" ;;
    *) fail "Architecture $(uname -m) is not supported (needs amd64 or arm64)." ;;
  esac

  local cpus mem_mb disk_gb
  cpus=$(nproc)
  mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
  disk_gb=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
  if [ "$cpus" -ge 2 ]; then ok "CPU cores: $cpus"; else warn "CPU cores: $cpus (Coolify recommends 2+)"; fi
  if [ "$mem_mb" -ge 1900 ]; then ok "Memory: ${mem_mb} MB"; else warn "Memory: ${mem_mb} MB (Coolify recommends 2 GB+; add swap if you continue)"; fi
  if [ "$disk_gb" -ge 10 ]; then ok "Free disk on /: ${disk_gb} GB"; else fail "Free disk on /: ${disk_gb} GB (needs at least 10 GB)"; fi

  if coolify_installed; then
    ok "Coolify is already installed and running"
  elif command -v docker >/dev/null 2>&1; then
    ok "Docker is installed ($(docker --version 2>/dev/null | cut -d, -f1)); Coolify is not installed yet"
  else
    ok "Docker is not installed yet (the Coolify installer will install it)"
  fi

  for port in 80 443 8000 6001 6002; do
    local owner
    owner=$(port_owner "$port")
    if [ -z "$owner" ]; then
      ok "Port $port is free"
    elif [[ "$owner" =~ docker-proxy|traefik|caddy ]] && coolify_installed; then
      ok "Port $port is used by Coolify ($owner)"
    else
      fail "Port $port is already used by: $owner"
    fi
  done
  if [ -n "$(port_owner 80)$(port_owner 443)" ] && ! coolify_installed; then
    echo
    echo "    Coolify's proxy needs ports 80 and 443. If Apache/Nginx serves phpMyAdmin or other sites here,"
    echo "    move it to another port first (see docs/deploy-coolify.md, 'Port 80/443 already in use')."
  fi

  local db_owner
  db_owner=$(port_owner 3306)
  if [ -n "$db_owner" ]; then
    ok "MariaDB/MySQL on port 3306 ($db_owner) is not used by html-to-img and is left untouched"
  fi

  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    warn "ufw firewall is active: allow 22, 80, 443 and (until you put the dashboard on a domain) 8000:  ufw allow 80,443,8000/tcp"
  fi

  echo
  if [ "$BLOCKERS" -gt 0 ]; then
    bold "Result: $BLOCKERS blocker(s) — fix them before installing Coolify."
    return 1
  fi
  bold "Result: ready$([ "$WARNINGS" -gt 0 ] && echo " (with $WARNINGS warning(s))")."
}

install() {
  require_root
  if coolify_installed; then
    ok "Coolify is already installed."
  else
    check || die "Fix the blockers above, then run: sudo bash $0 install"
    echo
    confirm "Install Coolify now with the official script (installs Docker, uses ports 80/443/8000)?" || die "Cancelled."
    curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
  fi
  local ip
  ip=$(public_ip)
  echo
  bold "Next steps (in your browser):"
  echo "  1. Open http://${ip}:8000 and create your Coolify admin account."
  echo "     Do this right away: the first person to open the page becomes the owner."
  echo "  2. Finish the onboarding with the default 'localhost' server."
  echo "  3. Settings > Advanced > API access: Enabled > Save."
  echo "  4. Keys & Tokens > API tokens: create a token with the 'root' permission and copy it."
  echo "  5. At your DNS provider, add an A record for your app domain pointing to ${ip}."
  echo "Then run:  sudo bash $0 deploy"
}

deploy() {
  require_root
  coolify_installed || die "Coolify is not running here. Run: sudo bash $0 install"

  local ip domain
  ip=$(public_ip)
  bold "Deploy html-to-img through Coolify (branch: $BRANCH)"
  read -r -s -p "Coolify API token (input hidden): " COOLIFY_TOKEN </dev/tty
  echo
  [ -n "$COOLIFY_TOKEN" ] || die "A token is required."
  read -r -p "App domain, e.g. img.example.com (leave empty for a temporary sslip.io domain): " domain </dev/tty
  read -r -p "Admin email for html-to-img (leave empty to skip): " ADMIN_EMAIL </dev/tty
  read -r -p "Use the Docker Hub mirror for the build image? Only needed after '429 Too Many Requests' [y/N] " mirror </dev/tty

  if [ -n "$domain" ]; then
    local resolved
    resolved=$(getent ahostsv4 "$domain" 2>/dev/null | awk 'NR==1 {print $1}')
    if [ "$resolved" != "$ip" ]; then
      printf '\033[33m! %s resolves to "%s", not this server (%s).\033[0m\n' "$domain" "${resolved:-nothing}" "$ip"
      echo "  HTTPS certificates will fail until the DNS A record points here (changes can take a few minutes)."
      confirm "Continue anyway?" || die "Cancelled. Fix DNS, then run this again."
    fi
  fi

  local node_image
  # Global (not local): the EXIT trap runs after this function has returned.
  WORKDIR=$(mktemp -d)
  trap 'rm -rf "${WORKDIR:-}"' EXIT
  curl -fsSL "$REPO_RAW/$BRANCH/deploy/coolify/provision.mjs" -o "$WORKDIR/provision.mjs" || die "Could not download provision.mjs for branch $BRANCH."

  node_image="node:22-alpine"
  docker image inspect "$node_image" >/dev/null 2>&1 || docker pull -q "$node_image" >/dev/null 2>&1 \
    || { node_image="mirror.gcr.io/library/node:22-alpine"; docker pull -q "$node_image" >/dev/null; }

  # The API call goes through docker-proxy, so Coolify sees the "coolify" network's gateway as the caller.
  COOLIFY_SOURCE_HINT=$(docker network inspect coolify --format '{{range .IPAM.Config}}{{.Subnet}} {{end}}' 2>/dev/null | xargs | tr ' ' ',')
  export COOLIFY_TOKEN ADMIN_EMAIL COOLIFY_SOURCE_HINT
  export COOLIFY_URL="http://127.0.0.1:8000" APP_DOMAIN="$domain" GIT_BRANCH="$BRANCH"
  export NODE_IMAGE=""
  [[ "${mirror:-}" =~ ^[Yy]$ ]] && NODE_IMAGE="mirror.gcr.io/library/node:22-bookworm-slim"

  # Values are passed by name (-e VAR), so the token never appears in the process list.
  docker run --rm --network host -v "$WORKDIR:/w:ro" \
    -e COOLIFY_URL -e COOLIFY_TOKEN -e APP_DOMAIN -e ADMIN_EMAIL -e GIT_BRANCH -e NODE_IMAGE -e COOLIFY_SOURCE_HINT \
    "$node_image" node /w/provision.mjs
  echo "  (In the webhook URL above, <your Coolify URL> is http://${ip}:8000 or your Coolify domain.)"
}

case "$COMMAND" in
  check) check ;;
  install) install ;;
  deploy) deploy ;;
  *)
    sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
    ;;
esac
