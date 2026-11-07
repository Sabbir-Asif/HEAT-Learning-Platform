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

### Quality checks

```sh
pnpm lint            # ESLint, no explicit any
pnpm format:check    # Prettier; `pnpm format` fixes
pnpm typecheck       # strict TypeScript
pnpm test            # Vitest
pnpm test:coverage   # Vitest with V8 coverage, 85% minimum
```

All rules live in `@heat/config`. A package opts in with one-line files (`eslint.config.mjs`, `vitest.config.mjs`, a tsconfig that extends `@heat/config/tsconfig/*`) and the root `package.json` points Prettier at the shared config. A package that holds rule logic (unlock, scoring, certificates) raises its coverage gate with `nodePreset({ threshold: 100 })`.

### Docker images

`pnpm turbo prune <app> --docker` produces a minimal workspace for one app (`frontend-public`, `frontend-internal`, `api` or `worker`). Production Dockerfiles arrive with the deployment tickets.

### Workspace rules

- One React version for the whole workspace, set in the `catalog:` block of `pnpm-workspace.yaml`.
- Public environment variables must start with `NEXT_PUBLIC_`; Turborepo includes them in the build cache key.
- `contracts` and `db` compile to `dist/` because the API imports them; `ui`, `api-client` and `i18n` ship TypeScript source and are compiled by the Next.js apps (`transpilePackages`).
- The worker imports the API's shared modules from `api/core`.
