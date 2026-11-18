#!/usr/bin/env bash
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_SSH_PUBLIC_KEY="${DEPLOY_SSH_PUBLIC_KEY:-}"
ENV_DIR="${ENV_DIR:-/etc/heat}"
TIMEZONE="${TIMEZONE:-Asia/Dhaka}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILES="$HERE/files"
changes=0

note() {
  printf 'CHANGED  %s\n' "$1"
  changes=$((changes + 1))
}

render() {
  sed "s/__DEPLOY_USER__/$DEPLOY_USER/g" "$1"
}

install_rendered() {
  local source="$1" target="$2" mode="$3" owner="$4" tmp
  tmp="$(mktemp)"
  render "$source" >"$tmp"
  mkdir -p "$(dirname "$target")"
  if [ -f "$target" ] && cmp -s "$tmp" "$target" \
    && [ "$(stat -c '%a %U:%G' "$target")" = "$mode $owner" ]; then
    rm -f "$tmp"
    return 1
  fi
  install -m "$mode" -o "${owner%%:*}" -g "${owner##*:}" "$tmp" "$target"
  rm -f "$tmp"
  note "$target"
  return 0
}

ensure_packages() {
  local missing=() package
  for package in ufw fail2ban unattended-upgrades apt-listchanges logrotate sudo openssh-server; do
    if ! dpkg -s "$package" >/dev/null 2>&1; then
      missing+=("$package")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    DEBIAN_FRONTEND=noninteractive apt-get update -q
    DEBIAN_FRONTEND=noninteractive apt-get install -y -q "${missing[@]}"
    note "packages: ${missing[*]}"
  fi
}

ensure_timezone_and_time() {
  if [ "$(timedatectl show -p Timezone --value)" != "$TIMEZONE" ]; then
    timedatectl set-timezone "$TIMEZONE"
    note "timezone $TIMEZONE"
  fi
  if [ "$(timedatectl show -p NTP --value)" != "yes" ]; then
    timedatectl set-ntp true
    note "ntp enabled"
  fi
}

ensure_deploy_user() {
  local home ssh_dir keys
  if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
    note "user $DEPLOY_USER"
  fi
  home="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
  ssh_dir="$home/.ssh"
  keys="$ssh_dir/authorized_keys"
  if ! id -nG "$DEPLOY_USER" | tr ' ' '\n' | grep -qx systemd-journal; then
    usermod -aG systemd-journal "$DEPLOY_USER"
    note "$DEPLOY_USER in systemd-journal"
  fi
  if [ ! -d "$ssh_dir" ]; then
    install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$ssh_dir"
    note "$ssh_dir"
  fi
  if [ ! -f "$keys" ]; then
    install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /dev/null "$keys"
    note "$keys"
  fi
  if [ -n "$DEPLOY_SSH_PUBLIC_KEY" ] && ! grep -qxF "$DEPLOY_SSH_PUBLIC_KEY" "$keys"; then
    printf '%s\n' "$DEPLOY_SSH_PUBLIC_KEY" >>"$keys"
    note "authorized key for $DEPLOY_USER"
  fi
  if [ "$(stat -c '%a %U' "$keys")" != "600 $DEPLOY_USER" ]; then
    chmod 600 "$keys"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$keys"
    note "permissions $keys"
  fi
  if [ ! -s "$keys" ]; then
    echo "no authorized key for $DEPLOY_USER: set DEPLOY_SSH_PUBLIC_KEY before hardening SSH" >&2
    exit 1
  fi
}

ensure_sudoers() {
  local tmp
  tmp="$(mktemp)"
  render "$FILES/sudoers-deploy" >"$tmp"
  if ! visudo -cf "$tmp" >/dev/null; then
    rm -f "$tmp"
    echo "sudoers rule failed validation" >&2
    exit 1
  fi
  rm -f "$tmp"
  install_rendered "$FILES/sudoers-deploy" /etc/sudoers.d/heat-deploy 440 root:root || true
}

ensure_ssh() {
  local target=/etc/ssh/sshd_config.d/00-heat-hardening.conf
  if install_rendered "$FILES/sshd-hardening.conf" "$target" 644 root:root; then
    if ! sshd -t; then
      rm -f "$target"
      echo "sshd configuration failed validation, change reverted" >&2
      exit 1
    fi
    systemctl reload ssh
  fi
}

ensure_firewall() {
  local status port
  status="$(ufw status verbose || true)"
  if ! printf '%s\n' "$status" | grep -q '^Default: deny (incoming), allow (outgoing)'; then
    ufw default deny incoming >/dev/null
    ufw default allow outgoing >/dev/null
    note "ufw defaults"
  fi
  for port in 22 80 443; do
    if ! printf '%s\n' "$status" | grep -qE "^$port/tcp +ALLOW IN"; then
      ufw allow "$port/tcp" >/dev/null
      note "ufw allow $port/tcp"
    fi
  done
  if ! printf '%s\n' "$status" | grep -q '^Status: active'; then
    ufw --force enable >/dev/null
    note "ufw enabled"
  fi
}

ensure_fail2ban() {
  local jail_changed=1
  if install_rendered "$FILES/fail2ban-sshd.local" /etc/fail2ban/jail.d/heat-sshd.local 644 root:root; then
    jail_changed=0
  fi
  systemctl enable fail2ban >/dev/null 2>&1
  if [ "$jail_changed" -eq 0 ] || ! systemctl is-active --quiet fail2ban; then
    systemctl restart fail2ban
  fi
}

ensure_unattended_upgrades() {
  install_rendered "$FILES/20auto-upgrades" /etc/apt/apt.conf.d/20auto-upgrades 644 root:root || true
  install_rendered "$FILES/52heat-unattended-upgrades" /etc/apt/apt.conf.d/52heat-unattended-upgrades 644 root:root || true
  systemctl enable apt-daily.timer apt-daily-upgrade.timer >/dev/null 2>&1
}

ensure_docker_daemon() {
  if install_rendered "$FILES/docker-daemon.json" /etc/docker/daemon.json 644 root:root; then
    if systemctl is-active --quiet docker; then
      systemctl restart docker
    fi
  fi
}

ensure_logs() {
  if install_rendered "$FILES/journald-heat.conf" /etc/systemd/journald.conf.d/heat.conf 644 root:root; then
    systemctl restart systemd-journald
  fi
  if [ ! -d /var/log/heat ]; then
    install -d -m 750 -o "$DEPLOY_USER" -g adm /var/log/heat
    note "/var/log/heat"
  fi
  install_rendered "$FILES/logrotate-heat" /etc/logrotate.d/heat 644 root:root || true
}

ensure_env_files() {
  local file
  if [ "$(stat -c '%a %U:%G' "$ENV_DIR" 2>/dev/null || true)" != "750 $DEPLOY_USER:$DEPLOY_USER" ]; then
    install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$ENV_DIR"
    chmod 750 "$ENV_DIR"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_DIR"
    note "$ENV_DIR"
  fi
  for file in "$ENV_DIR"/*.env; do
    [ -e "$file" ] || continue
    if [ "$(stat -c '%a %U:%G' "$file")" != "600 $DEPLOY_USER:$DEPLOY_USER" ]; then
      chmod 600 "$file"
      chown "$DEPLOY_USER:$DEPLOY_USER" "$file"
      note "permissions $file"
    fi
  done
}

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root" >&2
  exit 1
fi

ensure_packages
ensure_timezone_and_time
ensure_deploy_user
ensure_sudoers
ensure_ssh
ensure_firewall
ensure_fail2ban
ensure_unattended_upgrades
ensure_docker_daemon
ensure_logs
ensure_env_files

printf 'provisioning finished, %s change(s)\n' "$changes"
