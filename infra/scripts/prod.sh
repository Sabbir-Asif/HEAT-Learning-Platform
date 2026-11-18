#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

compose=(docker compose --env-file .env -f infra/prod/docker-compose.prod.yml)

value() {
  grep -E "^$1=" .env | head -n 1 | cut -d= -f2- || true
}

require() {
  local name="$1" current
  current="$(value "$name")"
  if [ -z "$current" ] || [[ "$current" == *CHANGE_ME* ]]; then
    echo "Set $name in .env before deploying" >&2
    exit 1
  fi
}

check_env() {
  [ -f .env ] || { echo "Copy .env.example to .env and fill it in" >&2; exit 1; }
  for name in PUBLIC_DOMAIN ADMIN_DOMAIN POSTGRES_PASSWORD DATABASE_URL AUTH_ACCESS_SECRET \
    CSRF_SECRET AUTH_ENCRYPTION_KEY REVALIDATE_SECRET HLS_SIGNING_KEYS SUPER_ADMIN_EMAIL \
    SUPER_ADMIN_PASSWORD SMTP_HOST SMTP_USER SMTP_PASSWORD SMTP_FROM_ADDRESS LETSENCRYPT_EMAIL; do
    require "$name"
  done
}

prepare() {
  local data_root
  data_root="$(value DATA_ROOT)"
  data_root="${data_root:-/srv/heat}"
  for dir in uploads hls media certificates; do
    sudo mkdir -p "$data_root/$dir"
  done
  sudo chown -R 1000:1000 "$data_root"
  sudo chmod -R u=rwX,go=rX "$data_root"
}

certificate_present() {
  "${compose[@]}" run --rm --no-deps --entrypoint sh certbot \
    -c "test -f /etc/letsencrypt/live/$(value PUBLIC_DOMAIN)/fullchain.pem"
}

certs() {
  "${compose[@]}" run --rm --no-deps -p 80:80 --entrypoint certbot certbot certonly \
    --standalone --non-interactive --agree-tos \
    --email "$(value LETSENCRYPT_EMAIL)" \
    -d "$(value PUBLIC_DOMAIN)" -d "$(value ADMIN_DOMAIN)"
}

deploy() {
  check_env
  prepare
  "${compose[@]}" build
  if ! certificate_present; then
    certs
  fi
  "${compose[@]}" up -d
  "${compose[@]}" ps
}

case "${1:-}" in
  prepare) check_env; prepare ;;
  certs) check_env; certs ;;
  deploy) deploy ;;
  logs) shift; "${compose[@]}" logs -f --tail 100 "$@" ;;
  ps) "${compose[@]}" ps ;;
  down) "${compose[@]}" down ;;
  *) echo "Usage: infra/scripts/prod.sh <prepare|certs|deploy|logs [service]|ps|down>" >&2; exit 1 ;;
esac
