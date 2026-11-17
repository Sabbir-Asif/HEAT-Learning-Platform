# VPS hardening

## When to use

Setting up a fresh VPS, or re-applying the baseline after a change. The script is idempotent: a second run on a configured host reports `0 change(s)`.

## What it sets up

Files live in `infra/provision/`; `provision.sh` applies them, `verify-host.sh` checks the result.

- SSH: key-only (`PasswordAuthentication no`, `AuthenticationMethods publickey`), root login off, only the deploy user allowed, drop-in `/etc/ssh/sshd_config.d/00-heat-hardening.conf` (the `00-` prefix makes it win over later files). The change is validated with `sshd -t` and reverted if invalid.
- Deploy user: named `deploy` by default, no password, sudo limited to status commands and a short list of service restarts (`/etc/sudoers.d/heat-deploy`, validated with `visudo -cf`). Deploys use the Docker group or the compose tooling set up in E14-2, not sudo.
- Firewall: ufw denies inbound by default and allows only 22, 80 and 443 over TCP.
- Docker and the firewall: Docker publishes ports through its own iptables rules that ufw does not filter. `/etc/docker/daemon.json` sets `"ip": "127.0.0.1"`, so any published port without an explicit address binds to loopback only. Only Nginx may publish, and it must bind explicitly (`0.0.0.0:80:80`, `0.0.0.0:443:443`). Postgres, Redis and app ports never get a host mapping on public interfaces.
- fail2ban: sshd jail, 5 failures in 10 minutes bans for 1 hour, doubling on repeat offences up to a week.
- Unattended upgrades: security origins only, automatic reboot at 03:00 Asia/Dhaka when a reboot is needed, logs in `/var/log/unattended-upgrades/` and syslog.
- Time: timezone Asia/Dhaka, NTP on through systemd-timesyncd.
- Logs: Docker `json-file` logs rotate at 10 MB, 5 files per container; the journal is capped at 500 MB; `/var/log/heat/*.log` rotates weekly; system logs use the stock logrotate.
- Secrets: `/etc/heat` is `750`, every `*.env` in it is `600`, owned by the deploy user. The script corrects drift on each run.

## Apply

Keep your current root or sudo session open until you have logged in as the deploy user in a second terminal.

```sh
sudo DEPLOY_USER=deploy DEPLOY_SSH_PUBLIC_KEY="$(cat ~/.ssh/id_ed25519.pub)" ./infra/provision/provision.sh
sudo ./infra/provision/verify-host.sh
sudo ./infra/provision/provision.sh
```

The script refuses to continue when the deploy user has no authorised key, so it cannot lock you out. The last command must print `provisioning finished, 0 change(s)`.

Settings: `DEPLOY_USER`, `DEPLOY_SSH_PUBLIC_KEY`, `ENV_DIR` (default `/etc/heat`), `TIMEZONE` (default `Asia/Dhaka`).

## Evidence for the pull request

Run on a disposable VM or the staging host, then record the output.

1. Idempotence: the second `provision.sh` run prints `0 change(s)`.
2. SSH refusals, from another machine:
   ```sh
   ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no deploy@HOST
   ssh -i KEY root@HOST
   ```
   Both must be refused (`Permission denied`).
3. Port scan from outside: `nmap -Pn -p- HOST` lists only 22, 80 and 443 open (80 and 443 once Nginx runs). Postgres, Redis and app ports are filtered or closed.
4. fail2ban: make six failed SSH attempts from one test IP, then `sudo fail2ban-client status sshd` shows it under `Banned IP list`. Unban with `sudo fail2ban-client set sshd unbanip IP`.
5. Unattended upgrades: `sudo unattended-upgrade --dry-run -d` lists the pending security updates; after the nightly run `/var/log/unattended-upgrades/unattended-upgrades.log` records the install.
6. Env files: `ls -l /etc/heat` shows `-rw-------` owned by the deploy user.

## Troubleshooting

- Locked out after the SSH change: use the provider console, remove `/etc/ssh/sshd_config.d/00-heat-hardening.conf`, run `systemctl reload ssh`, fix the key, apply again.
- A container is reachable from outside: check its compose `ports` entry for an explicit `0.0.0.0` binding and remove it unless it is Nginx.
