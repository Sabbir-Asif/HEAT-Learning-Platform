# Production Compose stack

## When to use

Starting, checking or changing the production stack on the VPS (and the staging copy, which uses the same file with its own env files). Prepare the host with [VPS hardening](vps-hardening.md) first.

## What it runs

`infra/compose.prod.yml` defines seven services: `nginx`, `frontend-public`, `frontend-internal`, `api`, `worker`, `postgres` and `redis`.

| Service           | Port inside | Starting limit        | Health check                             |
| ----------------- | ----------- | --------------------- | ---------------------------------------- |
| nginx             | 80, 443     | 1 CPU, 512 MB         | `GET /nginx-health`                      |
| frontend-public   | 3000        | 1 CPU, 768 MB         | `GET /` answers below 500                |
| frontend-internal | 3001        | 0.5 CPU, 512 MB       | `GET /` answers below 500                |
| api               | 4000        | 2 CPU, 2 GB           | `GET /api/health`                        |
| worker            | none        | 2 CPU, 3 GB           | the main process is alive                |
| postgres          | 5432        | 2 CPU, 3 GB           | `pg_isready`                             |
| redis             | 6379        | 1 CPU, 1 GB (768 MB data) | `redis-cli ping`                     |

These are starting budgets. Tune them from `docker stats` during a transcode with concurrent playback, then edit the limits in the file.

Rules the file follows:

- Networks: `web` (nginx, both frontends, API), `data` (internal, no outbound route: Postgres, Redis, API, worker) and `egress` (API and worker, for mail and the breached-password check). Postgres and Redis sit only on `data`.
- Only nginx publishes ports, bound explicitly to `0.0.0.0:80` and `0.0.0.0:443`.
- Every service has `restart: unless-stopped`, `no-new-privileges`, `TZ=Asia/Dhaka` and `json-file` logs rotated at 10 MB, 5 files. Applications, Postgres and Redis run as a non-root user with all capabilities dropped; nginx keeps only `CHOWN`, `SETGID`, `SETUID` and `NET_BIND_SERVICE`.
- Secrets are never in the file or the images. Each service reads `/etc/heat/<service>.env` (mode 600, set by the hardening script) when it starts.
- Postgres and Redis data live in the named volumes `postgres-data` and `redis-data`. Files live under `DATA_DIR` (default `/srv/heat`): `uploads` (video originals, mounted only into the API and worker, never into nginx), `hls`, `media`, `certificates` and `tmp` (worker scratch space).

## Prepare the host

```sh
sudo install -d -m 750 -o deploy /etc/heat /etc/heat/tls /etc/heat/nginx
sudo install -d -o 1000 -g 1000 /srv/heat/uploads /srv/heat/hls /srv/heat/media /srv/heat/certificates /srv/heat/tmp
```

Create these files in `/etc/heat`, each with mode 600 and owned by the deploy user, then run `sudo ./infra/provision/provision.sh` to confirm the modes:

- `compose.env`: copy `infra/compose.prod.env.example` and set the registry prefix, release tag and the Nginx site config path (`NGINX_SITE_CONF`, delivered by E14-3).
- `api.env`, `worker.env`, `frontend-public.env`, `frontend-internal.env`: start from each app's `.env.example`. Use the compose service names as hosts: `DATABASE_URL` to `postgres:5432`, `REDIS_URL` to `redis://redis:6379`, `PUBLIC_APP_INTERNAL_URL` to `http://frontend-public:3000`. Point the storage paths at `/srv/heat/uploads`, `/srv/heat/hls`, `/srv/heat/media`, `/srv/heat/certificates` and `/srv/heat/tmp`.
- `postgres.env`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
- `nginx.env`: `HLS_SIGNING_KEYS`, the same value as in `api.env`.

## Start and check

```sh
docker compose -f infra/compose.prod.yml --env-file /etc/heat/compose.env config --quiet
docker compose -f infra/compose.prod.yml --env-file /etc/heat/compose.env up -d --wait
docker compose -f infra/compose.prod.yml --env-file /etc/heat/compose.env ps
```

`up -d --wait` returns once every service is healthy. `ps` must show `healthy` for all seven.

## Evidence for the pull request

Run on the staging host; record the output.

1. Healthy: `docker compose ... ps` shows every service `healthy`.
2. Restart: `docker kill <project>-api-1`, then `docker compose ... ps` until the API is `healthy`, then `curl -I https://<host>/api/health` returns 200 through nginx. If nginx keeps routing to a dead address, the site config must resolve the upstream at request time (Docker DNS `127.0.0.11` with a variable in `proxy_pass`); that belongs to E14-3.
3. Worker limit: start a transcode, play videos from several clients, run `docker stats --no-stream`; worker CPU stays at or below 200% and memory below 3 GB while playback requests succeed.
4. Outside probe: from another machine, `nmap -Pn -p- <host>` lists only 22, 80 and 443; ports 3000, 3001, 4000, 5432 and 6379 are filtered or closed.
5. No secrets in images: `docker history --no-trunc <image>` and `docker inspect <image>` show no secret values, and the compose file lists no secret.
6. Time zone: `docker compose ... exec api date` prints `+06`, and scheduled jobs log Asia/Dhaka times.

## Troubleshooting

- A service stays `unhealthy`: `docker compose ... logs --tail=100 <service>`, then fix the env file and run `up -d` again.
- The stack refuses to start with a message naming a variable: add it to `/etc/heat/compose.env`.
- Postgres or the apps cannot write a directory: check that `/srv/heat/*` is owned by uid 1000.
- Out of memory kills: `docker inspect <container> --format '{{.State.OOMKilled}}'`; raise that service's limit only after checking `docker stats`.

## Not covered yet

Application image builds and the image scan in CI, the production Nginx site and TLS config (E14-3), the staging copy (E14-8), backups (E14-5, E14-9), Redis authentication, a worker heartbeat health check, and tuning Postgres settings to its memory limit.
