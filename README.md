# Women Safety Awareness Program (WSAP) Learning Platform

## Development

A pnpm + Turborepo monorepo. Requires Node 22.22 (`nvm use`) and pnpm 11 (`corepack enable`; the version is pinned in `package.json`).

```
apps/
  frontend-public/    Next.js, public site and learner area   :3000
  frontend-internal/  Next.js, admin console                  :3001
  api/                NestJS HTTP API, GET /api/health        :4000
  worker/             Same codebase as the API, no HTTP listener
packages/
  contracts/  Zod schemas and shared types        db/       Prisma (added later)
  api-client/ Generated API client and fetchers   ui/       Shared components and tokens
  config/     tsconfig, ESLint, Prettier and Vitest presets; repository scripts (audit:deps, brand, github:setup, ticket)
```

### Install and build

```sh
pnpm install
pnpm turbo build        # builds every package and app
pnpm turbo build lint typecheck test
```

### First run

```sh
pnpm install
pnpm dev:up
pnpm --filter @heat/db exec prisma migrate deploy
SEED_SAMPLE_DIRECTORY=true pnpm --filter @heat/db exec prisma db seed
pnpm dev
```

`pnpm dev:up` creates `apps/api/.env` from `apps/api/.env.example` when it is missing; the example holds working development values, including the three secrets. If an older copy of the file has empty secrets, copy the example over it. The seed reads `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from `apps/api/.env`; the example values are `admin@heat.localhost` and `ChangeMe-Local-Admin-2026`. Set both in the command line instead to use your own (the password needs at least 12 characters). Open the apps through Nginx, not on ports 3000 and 3001 directly: the browser calls `/api` on the same host, and only Nginx forwards it to the API. Use <http://learn.localhost> for the public site and <http://admin.localhost> for the admin console (add `:8080` if you moved `HTTP_PORT`, see [Local development](docs/guides/local-development.md#when-port-80-is-taken)). You are asked to change the password at first sign-in. `SEED_SAMPLE_DIRECTORY=true` adds sample faculties and departments so student sign-up has choices; the seed refuses it when `NODE_ENV=production`. Mail is caught by Mailpit at <http://localhost:8035>, so open it for verification links and certificate emails. The worker needs ffmpeg on the host for video transcoding and a Chromium for certificate PDFs (`CHROMIUM_EXECUTABLE_PATH` in `apps/worker/.env`).

Starting from a machine with nothing installed? Follow [Set up on Windows](docs/guides/setup-windows.md) or [Set up on Linux](docs/guides/setup-linux.md); both end with a demo mode that builds once so pages open without compiling.

### Run each app

| App                 | Dev                                   | Production build                                                                 |
| ------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| `frontend-public`   | `pnpm --filter frontend-public dev`   | `pnpm --filter frontend-public build && pnpm --filter frontend-public start`     |
| `frontend-internal` | `pnpm --filter frontend-internal dev` | `pnpm --filter frontend-internal build && pnpm --filter frontend-internal start` |
| `api`               | `pnpm --filter api dev`               | `pnpm --filter api build && pnpm --filter api start`                             |
| `worker`            | `pnpm --filter worker dev`            | `pnpm --filter worker build && pnpm --filter worker start`                       |

`pnpm dev` starts everything through Turborepo. Check the apps with `curl localhost:4000/api/health` and by opening ports 3000 and 3001. The worker logs `Worker ready` and opens no port.

### Local services (Docker)

`pnpm dev:up` starts Postgres 17, Redis, Nginx and Mailpit and returns once all four are healthy. On first run it copies each `.env.example` to `.env`; the copies are ignored by git. Mailpit catches all outgoing mail at <http://localhost:8035>. Ports, the Nginx hosts and the Linux note are in [Local development](docs/guides/local-development.md).

```sh
pnpm dev:up      # start and wait until healthy
pnpm dev:down    # stop, keep the data
pnpm dev:reset   # stop, delete the Postgres and Redis volumes, start again empty
```

### Quality checks

```sh
pnpm lint            # ESLint, no explicit any, styling rules
pnpm format:check    # Prettier; `pnpm format` fixes
pnpm typecheck       # strict TypeScript
pnpm test            # Vitest
pnpm test:coverage   # Vitest with V8 coverage, 85% minimum
```

The styling rules, test layout, integration tests, visual baselines, Lighthouse budgets and Storybook are in [Quality and testing](docs/guides/quality-and-testing.md).

### Production deployment (single VPS)

```sh
cp .env.example .env
$EDITOR .env
infra/scripts/prod.sh deploy
```

Point the DNS A records of `PUBLIC_DOMAIN` and `ADMIN_DOMAIN` at the server first, and replace every `CHANGE_ME` value in `.env`. The stack, the secrets, the data folders and the known limits are in [Production deployment](docs/guides/deployment.md).

### Conventions

The quality bar, the delivery workflow and the rules for each app and package are in `CLAUDE.md` at the repo root and in each area's directory; the root file links to the rest. A rule is written in one file only. `packages/config/test/docs.test.mjs` fails if the root file reaches 200 lines, an area file is missing, a link or heading anchor in these files is dead, or a sentence is repeated between files.

### Workspace rules

- One React version for the whole workspace, set in the `catalog:` block of `pnpm-workspace.yaml`.
- Public environment variables must start with `NEXT_PUBLIC_`; Turborepo includes them in the build cache key.
- `contracts` and `db` compile to `dist/` because the API imports them; `ui` and `api-client` ship TypeScript source and are compiled by the Next.js apps (`transpilePackages`).
- The worker imports the API's shared modules from `api/core`.

### More documentation

| Guide                                                        | Covers                                                                     |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [Local development](docs/guides/local-development.md)        | Docker services, ports, Nginx hosts                                        |
| [Quality and testing](docs/guides/quality-and-testing.md)    | Styling rules, test layout, integration tests, visual baselines, Storybook |
| [Database and rollups](docs/guides/database.md)              | Schema, seed, insight rollups and backfill                                 |
| [API client](docs/guides/api-client.md)                      | OpenAPI spec and the generated client                                      |
| [Design and brand](docs/guides/design-and-brand.md)          | Design file, theme and logo assets                                         |
| [CI, GitHub setup and tickets](docs/guides/ci-and-github.md) | Required checks, branch protection, labels and project, the ticket command |
| [Workflow hooks](docs/guides/workflow-hooks.md)              | Claude Code guard rails                                                    |
| [Production deployment](docs/guides/deployment.md)           | Single-VPS Docker stack                                                    |

Decisions are in [docs/adr](docs/adr/), runbooks in [docs/runbooks](docs/runbooks/), the plan in `docs/plan/` and the data model in [docs/data-model.md](docs/data-model.md).
