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

### Continuous integration

Pull requests and pushes to `main` run these checks in GitHub Actions; each is a required status check:

| Check                                          | Runs                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `lint`, `format`, `typecheck`, `test`, `build` | The matching root script through Turborepo (`test` runs coverage)    |
| `integration`                                  | `test:integration` in any package that defines it (Testcontainers)   |
| `audit`                                        | `pnpm audit:deps`, also weekly; fails on high or critical advisories |

CodeQL runs from `.github/workflows/codeql.yml` and Dependabot from `.github/dependabot.yml` (npm and GitHub Actions; Docker is added with the Dockerfiles). Turborepo's cache lives in `.turbo` and is restored per task, so unchanged packages replay instead of re-running.

Workflow rules, enforced by `packages/config/test/workflows.test.mjs`: every external action is pinned to a commit SHA, each workflow sets `permissions`, and `pull_request_target` is not used.

**Audit ignore list.** To accept an advisory you cannot fix yet, add `{ "advisory": "GHSA-...", "reason": "...", "expires": "YYYY-MM-DD" }` to `.github/audit-ignore.json`. A reason is required, the expiry is at most 90 days out, and an expired entry fails the audit.

**Branch protection.** `main` requires the checks above, linear history (merge with squash or rebase), and blocks force pushes and deletions. There is no required-approval rule; only the owner merges. Apply or re-apply it with:

```sh
gh api -X PUT repos/Sabbir-Asif/HEAT-Learning-Platform/branches/main/protection --input .github/branch-protection.json
```

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
