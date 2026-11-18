# Production deployment (single VPS)

Everything needed to deploy the stack on one server.

`infra/prod/` holds one Dockerfile with the targets `api`, `worker` (adds ffmpeg and Chromium), `migrate` (Prisma CLI and seed) and `frontend` (Next.js standalone, built once per app), and `docker-compose.prod.yml` with Postgres, Redis, a one-shot `migrate` service (the `migrate` target: `prisma migrate deploy`, then the idempotent seed), the API, the worker, both frontends, Nginx and a certbot renewal loop. Nginx is built from `infra/nginx/prod.conf.template` (TLS, HTTP to HTTPS redirect, `/api/admin` hidden on the public host, large video uploads on the admin host) and reuses the HLS, certificate and media includes of the dev stack. Only ports 80 and 443 are published.

```sh
cp .env.example .env
$EDITOR .env
infra/scripts/prod.sh deploy
infra/scripts/prod.sh logs api
```

Point the DNS A records of `PUBLIC_DOMAIN` and `ADMIN_DOMAIN` at the server first; `deploy` obtains one Let's Encrypt certificate for both names the first time. Every `CHANGE_ME` value in `.env` must be replaced, and the API refuses to start with a weak secret. Generate secrets with `openssl rand -base64 48`, and `openssl rand -base64 32` for `AUTH_ENCRYPTION_KEY`. Media lives under `DATA_ROOT` (default `/srv/heat`) on the host. The app connects to Postgres as the container's owner role, so the audit log is protected by its triggers and not by the `heat_app` role. Monitoring, off-site backups, a staging copy and load tests are separate tickets and are not part of this stack.

## Docker images

`pnpm turbo prune <app> --docker` produces a minimal workspace for one app (`frontend-public`, `frontend-internal`, `api` or `worker`).

## Server sizing

A Hostinger KVM2 (2 vCPU, 8 GB RAM, 100 GB disk) runs the stack. Add a 4 GB swap file before the first build, which takes about 15 minutes without a cache. The CPU is the limit: video transcoding is slow on 2 vCPUs and slows the site while it runs, so upload one video at a time. The `api` image is about 0.9 GB and the `worker` image about 2.3 GB.

## Email with a personal Gmail account

Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_TLS=starttls`, and use the Gmail address for both `SMTP_USER` and `SMTP_FROM_ADDRESS`. `SMTP_PASSWORD` is an app password (turn on 2-step verification, then create it at myaccount.google.com/apppasswords), not the account password. A personal account sends about 500 messages a day, so `.env.example` caps the app at `EMAIL_DAILY_LIMIT=400` with budgets per category. Mail comes from the Gmail address and may land in spam for new recipients.
