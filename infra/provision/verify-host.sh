#!/usr/bin/env bash
set -u

DEPLOY_USER="${DEPLOY_USER:-deploy}"
ENV_DIR="${ENV_DIR:-/etc/heat}"
failures=0

pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }

check() {
  if eval "$2" >/dev/null 2>&1; then pass "$1"; else fail "$1"; fi
}

sshd_value() {
  sshd -T 2>/dev/null | awk -v key="$1" '$1 == key { print $2 }'
}

expect_ssh() {
  if [ "$(sshd_value "$1")" = "$2" ]; then pass "$3"; else fail "$3"; fi
}

expect_ssh permitrootlogin no "ssh root login disabled"
expect_ssh passwordauthentication no "ssh password login disabled"
expect_ssh kbdinteractiveauthentication no "ssh keyboard-interactive disabled"
check "ssh limited to $DEPLOY_USER" "sshd -T | grep -qx 'allowusers $DEPLOY_USER'"

check "$DEPLOY_USER reads the journal through the systemd-journal group" "id -nG $DEPLOY_USER | tr ' ' '\\n' | grep -qx systemd-journal"
check "sudo for $DEPLOY_USER has no wildcard and no journalctl" "! grep -E '\\*|journalctl' /etc/sudoers.d/heat-deploy"

check "ufw active" "ufw status | grep -q '^Status: active'"
check "ufw denies incoming by default" "ufw status verbose | grep -q 'deny (incoming)'"
for port in 22 80 443; do
  check "ufw allows $port/tcp" "ufw status | grep -qE '^$port/tcp +ALLOW'"
done

unexpected="$(ss -H -tln | awk '{ print $4 }' | grep -vE '^(127\.|\[::1\])' | sed 's/.*://' | sort -un | grep -vxE '22|80|443' || true)"
if [ -z "$unexpected" ]; then
  pass "only 22, 80 and 443 listen on public interfaces"
else
  fail "unexpected public listeners: $(echo "$unexpected" | tr '\n' ' ')"
fi

check "docker publishes on loopback by default" "grep -q '\"ip\": \"127.0.0.1\"' /etc/docker/daemon.json"
check "docker log rotation set" "grep -q '\"max-size\"' /etc/docker/daemon.json"

check "fail2ban sshd jail running" "fail2ban-client status sshd"
check "unattended upgrades timer enabled" "systemctl is-enabled apt-daily-upgrade.timer"
check "unattended upgrades reboot in the window" "apt-config dump | grep -q 'Automatic-Reboot \"true\"'"
check "time synchronised" "[ \"\$(timedatectl show -p NTPSynchronized --value)\" = yes ]"
check "timezone is Asia/Dhaka" "[ \"\$(timedatectl show -p Timezone --value)\" = Asia/Dhaka ]"

for file in "$ENV_DIR"/*.env; do
  [ -e "$file" ] || continue
  check "env file $file is 600 and owned by $DEPLOY_USER" "[ \"\$(stat -c '%a %U' '$file')\" = '600 $DEPLOY_USER' ]"
done

if [ "$failures" -gt 0 ]; then
  printf '%s check(s) failed\n' "$failures"
  exit 1
fi
printf 'all checks passed\n'
