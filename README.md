# HEAT-Learning-Platform

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
  api-client/ Generated API client (added later)  ui/       Shared components and tokens
  i18n/       Message catalogs                    config/   tsconfig presets
```

### Install and build

```sh
pnpm install
pnpm turbo build        # builds every package and app
pnpm turbo build lint typecheck test
```

### Run each app

| App                 | Dev                                   | Production build                                                                 |
| ------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| `frontend-public`   | `pnpm --filter frontend-public dev`   | `pnpm --filter frontend-public build && pnpm --filter frontend-public start`     |
| `frontend-internal` | `pnpm --filter frontend-internal dev` | `pnpm --filter frontend-internal build && pnpm --filter frontend-internal start` |
| `api`               | `pnpm --filter api dev`               | `pnpm --filter api build && pnpm --filter api start`                             |
| `worker`            | `pnpm --filter worker dev`            | `pnpm --filter worker build && pnpm --filter worker start`                       |

`pnpm dev` starts everything through Turborepo. Check the apps with `curl localhost:4000/api/health` and by opening ports 3000 and 3001. The worker logs `Worker ready` and opens no port.

### Local services (Docker)

`pnpm dev:up` starts Postgres 17, Redis, Nginx and Mailpit from `infra/compose/docker-compose.dev.yml` and returns once all four are healthy (it waits up to 60 seconds). On first run it copies each `.env.example` to `.env` (`infra/compose/` and every app, mode 600); edit the copies, they are ignored by git. Only `infra/compose/.env` is read today; the app files list the variables the apps will read once configuration loading lands.

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

### Quality checks

```sh
pnpm lint            # ESLint, no explicit any
pnpm format:check    # Prettier; `pnpm format` fixes
pnpm typecheck       # strict TypeScript
pnpm test            # Vitest
pnpm test:coverage   # Vitest with V8 coverage, 85% minimum
```

All rules live in `@heat/config`. A package opts in with one-line files (`eslint.config.mjs`, `vitest.config.mjs`, a tsconfig that extends `@heat/config/tsconfig/*`) and the root `package.json` points Prettier at the shared config. A package that holds rule logic (unlock, scoring, certificates) raises its coverage gate with `nodePreset({ threshold: 100 })`.

### Continuous integration

Pull requests and pushes to `main` run these checks in GitHub Actions; each is a required status check:

| Check                                          | Runs                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `lint`, `format`, `typecheck`, `test`, `build` | The matching root script through Turborepo (`test` runs coverage)    |
| `integration`                                  | `test:integration` in any package that defines it (Testcontainers)   |
| `audit`                                        | `pnpm audit:deps`, also weekly; fails on high or critical advisories |

Dependabot runs from `.github/dependabot.yml` (npm, GitHub Actions and the dev compose images; app Dockerfiles are added with the deployment tickets). CodeQL is left out: GitHub only stores its results for a private repository with code security enabled. Add it back if the repository goes public or code security is bought. In CI, Turborepo's cache lives in `.turbo` and is restored per task, so unchanged packages replay instead of re-running.

Workflow rules, enforced by `packages/config/test/workflows.test.mjs`: every external action is pinned to a commit SHA, each workflow sets `permissions`, and `pull_request_target` is not used.

**Audit ignore list.** To accept an advisory you cannot fix yet, add `{ "advisory": "GHSA-...", "reason": "...", "expires": "YYYY-MM-DD" }` to `.github/audit-ignore.json`. A reason is required, the expiry is at most 90 days out, and an expired entry fails the audit.

**Branch protection.** `main` requires the checks above, linear history (merge with squash or rebase), and blocks force pushes and deletions. Changes go through a pull request, but no approval is required; only the owner merges. Apply or re-apply it with:

```sh
gh api -X PUT repos/Sabbir-Asif/HEAT-Learning-Platform/branches/main/protection --input .github/branch-protection.json
```

### Conventions

The quality bar, the delivery workflow and the rules for each app and package are in `CLAUDE.md` at the repo root and in each area's directory; the root file links to the rest. A rule is written in one file only. `packages/config/test/docs.test.mjs` fails if the root file reaches 200 lines, an area file is missing, a link or heading anchor in these files is dead, or a sentence is repeated between files.

### Where tests live

Every app and package keeps its tests in a `test/` directory at its root, mirroring the paths under `src/` (`src/health/health.controller.ts` is tested by `test/health/health.controller.test.ts`). Test files end in `.test.ts` or `.test.tsx` and import the code under test from `../src/...`.

This is enforced: the Vitest preset only runs `test/**`, and `packages/config/test/layout.test.mjs` fails if a test file sits anywhere else or an app or package has no `test/` directory. Fixtures and helpers go in `test/` too (for example `test/fixtures/`).

### Docker images

`pnpm turbo prune <app> --docker` produces a minimal workspace for one app (`frontend-public`, `frontend-internal`, `api` or `worker`). Production Dockerfiles arrive with the deployment tickets.

### Workspace rules

- One React version for the whole workspace, set in the `catalog:` block of `pnpm-workspace.yaml`.
- Public environment variables must start with `NEXT_PUBLIC_`; Turborepo includes them in the build cache key.
- `contracts` and `db` compile to `dist/` because the API imports them; `ui`, `api-client` and `i18n` ship TypeScript source and are compiled by the Next.js apps (`transpilePackages`).
- The worker imports the API's shared modules from `api/core`.
