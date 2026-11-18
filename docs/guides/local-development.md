# Local development

What `pnpm dev:up` starts, the host addresses and how Nginx reaches the apps. The quick start is in the [README](../../README.md#first-run).

## Local services (Docker)

`pnpm dev:up` starts Postgres 17, Redis, Nginx and Mailpit from `infra/compose/docker-compose.dev.yml` and returns once all four are healthy (it waits up to 60 seconds). On first run it copies each `.env.example` to `.env` (`infra/compose/` and every app, mode 600); edit the copies, they are ignored by git. `infra/compose/.env` configures the containers. `apps/api/.env` is loaded by `pnpm --filter api dev` and by the Prisma commands in `packages/db` (migrate and seed), which read `DATABASE_URL` from it when it is not already set. Real environment variables win over the file.

| Service  | Host address                                                    | Notes                                                                 |
| -------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| Postgres | `localhost:5440`, user, password and database `heat`            | Data in the `postgres-data` volume                                    |
| Redis    | `localhost:6390`                                                | Append-only, `maxmemory-policy noeviction` (BullMQ requires it)       |
| Mailpit  | SMTP `localhost:1035`, web UI <http://localhost:8035>           | Catches all outgoing mail; nothing is delivered                       |
| Nginx    | <http://learn.localhost> and <http://admin.localhost> (port 80) | `/api` on both hosts goes to the API; everything else to the frontend |

The apps run on the host (`pnpm dev`), and Nginx forwards to them on ports 3000, 3001 and 4000 through `host.docker.internal`, so start them for the hosts to answer. `*.localhost` resolves to your machine without a hosts-file change. Keep the apps bound to `127.0.0.1` where Nginx can reach them (Docker Desktop on macOS and Windows); on Linux `host.docker.internal` is the Docker bridge address, so bind to that interface or add a firewall rule rather than listening on `0.0.0.0`, which exposes the apps to your network and skips Nginx. The host ports are uncommon on purpose so the stack runs next to a local Postgres, Redis or Mailpit; change them in `infra/compose/.env` (and the matching URLs in the app `.env` files) if they clash.

```sh
pnpm dev:up      # start and wait until healthy
pnpm dev:down    # stop, keep the data
pnpm dev:reset   # stop, delete the Postgres and Redis volumes, start again empty
```

## Why sign-in needs the Nginx hosts

The frontends do not proxy `/api`. A request such as `POST /api/admin/auth/sign-in` sent to `localhost:3001` reaches Next.js, which answers with a redirect, and the page shows "The server sent an unexpected reply". Open <http://admin.localhost> and <http://learn.localhost> instead, so Nginx sends `/api` to the API on port 4000.

## When port 80 is taken

If another program holds port 80, `pnpm dev:up` fails with "address already in use" on the Nginx container. Change the host port and the allowed origins:

```sh
sed -i 's/^HTTP_PORT=.*/HTTP_PORT=8080/' infra/compose/.env
```

Then add `http://learn.localhost:8080` and `http://admin.localhost:8080` to `TRUSTED_ORIGINS` in `apps/api/.env`, restart `pnpm dev`, and open <http://admin.localhost:8080> and <http://learn.localhost:8080>.

