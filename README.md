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
  api-client/ Generated API client and fetchers   ui/       Shared components and tokens
  i18n/       Message catalogs
  config/     tsconfig, ESLint, Prettier and Vitest presets; repository scripts (audit:deps, github:setup, ticket)
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
pnpm lint            # ESLint, no explicit any, styling rules below
pnpm format:check    # Prettier; `pnpm format` fixes
pnpm typecheck       # strict TypeScript
pnpm test            # Vitest
pnpm test:coverage   # Vitest with V8 coverage, 85% minimum
```

All rules live in `@heat/config`. A package opts in with one-line files (`eslint.config.mjs`, `vitest.config.mjs`, a tsconfig that extends `@heat/config/tsconfig/*`) and the root `package.json` points Prettier at the shared config. A package that holds rule logic (unlock, scoring, certificates) raises its coverage gate with `nodePreset({ threshold: 100 })`.

Styling stays inside `@heat/ui` (ADR 0013), and lint enforces it. The two Next.js apps use `@heat/config/eslint/app`, `@heat/ui` uses `@heat/config/eslint/ui`; the rules live in `packages/config/eslint/styling.js` and the script rules apply to `src` (`.js`, `.jsx`, `.ts`, `.tsx`) only. The CSS rule covers every `.css` file in an app (build output excluded).

| Rule                                                                                                                                                                                                                                                                                | Apps | `@heat/ui`  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------- |
| Conflicting Tailwind classes (`p-2 p-4`) and class order are errors; `eslint --fix` reorders                                                                                                                                                                                        | yes  | yes         |
| No arbitrary values (`mt-[13px]`, `[&>*]:p-2`) in strings, template literals, `cn`, `clsx`, `cva`                                                                                                                                                                                   | yes  | allowed     |
| Layout classes only: display, flex, grid, gap, space, alignment, padding, margin, sizing, `aspect-*`, overflow, `container`, `truncate`, `sr-only`, with the variants `sm` to `2xl`, `min-*`, `max-*`, `@sm` container variants, `motion-reduce` and `print`. Everything else fails | yes  | allowed     |
| No `style` attribute, no `<style>` element, no stylesheet import other than `./globals.css` or `@/app/globals.css`                                                                                                                                                                  | yes  | allowed     |
| No `.css` file anywhere in the app other than `src/app/globals.css`, which may hold only `@import "@heat/ui/styles.css"` and `@source` lines                                                                                                                                        | yes  | not checked |

The Tailwind plugin reads its theme from `packages/config/eslint/tailwind-entry.css` until `@heat/ui` carries the real theme. The class rules read `class`, `className`, any attribute ending in `Class`, `ClassName` or `ClassNames` (such as `containerClassName`), the values of a `classNames` object, and the arguments of `cn`, `clsx`, `cva`, `twMerge` and the plugin's other default helpers. Remaining gaps: a spread props object (`{...props}`), `React.createElement("div", { style })`, class names built at run time or held in an unrelated variable, and `test/` and Playwright files are not inspected. The class rules are silent when `tailwindcss` cannot be resolved from the linted package, so each app, `@heat/ui` and `@heat/config` has `tailwindcss` as a dev dependency and `packages/config/test/styling-setup.test.mjs` fails if that breaks. The no-comments rule also rules out `eslint-disable` comments. The editor hook lints only script files, so the CSS rule is enforced by `pnpm lint` and CI.

### Storybook

`@heat/ui` has a Storybook 10 workbench with the accessibility addon (axe) and the Vitest addon. Stories sit next to their component as `src/**/*.stories.tsx`; the config is in `packages/ui/.storybook/`.

```sh
pnpm --filter @heat/ui storybook                              # dev server on http://localhost:6006
pnpm --filter @heat/ui exec playwright install chromium       # one time: the browser the story tests use
pnpm --filter @heat/ui test:stories                           # every story rendered in Chromium and checked with axe
pnpm --filter @heat/ui build-storybook                        # static build in packages/ui/storybook-static (ignored by git)
```

The toolbar has a theme control (light, dark: the `.dark` class on the story root and on `<html>`) and a locale control (`en`, `bn`: the `lang` attribute; `dir` stays `ltr`). A story pins both with `globals: { theme, locale }`, which locks the toolbar for that story, so each component gets one story for every combination plus a `Default` story that follows the toolbar. Sample text is written in the story, because `@heat/ui` has no i18n dependency. The temporary Bangla and Latin font is self-hosted from `@fontsource-variable/noto-sans-bengali` through `.storybook/preview.css`.

An axe violation fails the story test and the output names the rule, for example `button-name`. A story that must accept a known violation sets `parameters.a11y.test` to `"todo"` with a reason. Story tests are not part of `pnpm test` or the coverage gate; they run in `test:stories` and in the `storybook` CI job.

### API client

The API describes itself, and the browser and Server Components call it through code generated from that description (ADR 0015). Nothing is written by hand between the controllers and the hooks.

```sh
pnpm generate                      # build contracts and the API, emit the spec, run orval
pnpm --filter api openapi          # only the spec, after `pnpm --filter api build`
pnpm --filter @heat/api-client generate   # only orval, from the committed spec
```

1. Controllers use `nestjs-zod` DTOs built from `@heat/contracts` schemas and `@nestjs/swagger` decorators. `apps/api/src/openapi/` creates the application in preview mode (the module graph, no provider instantiated), so the spec needs no database, Redis or server. The output has sorted keys and no timestamp, path or environment value.
2. `apps/api/openapi.json` is committed, so an API change shows in the diff.
3. Orval 8 turns it into `packages/api-client/src/generated/`: TanStack Query hooks and MSW handlers (`client/`), plain typed functions for Server Components (`server/`) and Zod schemas (`zod/`). The generated files are committed, skipped by ESLint, Prettier and the coverage gate, and still type-checked.

| Import                     | For                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `@heat/api-client`         | Hooks, model types, `ApiError`, `registerRequestInterceptor`, `setUnauthorizedHandler`  |
| `@heat/api-client/server`  | `serverFetch` and the server functions; `server-only`, a Client Component cannot use it |
| `@heat/api-client/mocks`   | MSW handlers and response factories for tests and Storybook                             |
| `@heat/api-client/schemas` | Generated Zod schemas, for parsing responses (forms use `@heat/contracts`)              |

Errors have one shape: `{ "error": { "code", "message", "requestId", "fields": [{ "path", "code" }] } }`, with `code` from the closed list in `@heat/contracts`. A global filter in the API produces it with fixed message text. Both the browser mutator and the server fetcher throw an `ApiError` carrying the status, code, field paths, request id and `Retry-After`; when no envelope arrives (an Nginx error page, a network failure, an abort) the code is `UNEXPECTED_RESPONSE`, `NETWORK_ERROR` or `REQUEST_ABORTED`.

The server fetcher reads `API_INTERNAL_URL`, the API's address on the internal network (`http://api:4000` in Docker, `http://localhost:4000` locally; the API listens on 4000, not the 3000 written in the first design text). It throws a configuration error when the variable is missing and has no fallback. It forwards only the incoming `Cookie` header, does not follow redirects and does not cache unless asked. Pass `forwardCookies: false` inside `'use cache'` functions.

The CSRF header and the 401 refresh are not part of this package yet. They register through `registerRequestInterceptor` and `setUnauthorizedHandler` when their tickets land.

### Continuous integration

Pull requests and pushes to `main` run these checks in GitHub Actions; each is a required status check:

| Check                                          | Runs                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `lint`, `format`, `typecheck`, `test`, `build` | The matching root script through Turborepo (`test` runs coverage)    |
| `integration`                                  | `test:integration` in any package that defines it (Testcontainers)   |
| `audit`                                        | `pnpm audit:deps`, also weekly; fails on high or critical advisories |

The `storybook` job is separate and not yet a required check: it runs the story tests with axe and builds static Storybook, and uploads it as the `storybook-static` artifact (7 days, also when the tests fail). It runs on every pull request. The owner adds it to `.github/branch-protection.json` and re-applies the protection.

The `api-client-drift` job is separate and not yet a required check either. It builds contracts and the API, regenerates `apps/api/openapi.json` and `packages/api-client/src/generated/`, and fails when any file differs from what is committed (modified, deleted or new), listing the files. Run `pnpm generate` and commit the result to fix it.

Dependabot runs from `.github/dependabot.yml` (npm, GitHub Actions and the dev compose images; app Dockerfiles are added with the deployment tickets). CodeQL is left out: GitHub only stores its results for a private repository with code security enabled. Add it back if the repository goes public or code security is bought. In CI, Turborepo's cache lives in `.turbo` and is restored per task, so unchanged packages replay instead of re-running.

Workflow rules, enforced by `packages/config/test/workflows.test.mjs`: every external action is pinned to a commit SHA, each workflow sets `permissions`, and `pull_request_target` is not used.

**Audit ignore list.** To accept an advisory you cannot fix yet, add `{ "advisory": "GHSA-...", "reason": "...", "expires": "YYYY-MM-DD" }` to `.github/audit-ignore.json`. A reason is required, the expiry is at most 90 days out, and an expired entry fails the audit.

**Branch protection.** `main` requires the checks above, linear history (merge with squash or rebase), and blocks force pushes and deletions. Changes go through a pull request, but no approval is required; only the owner merges. Apply or re-apply it with:

```sh
gh api -X PUT repos/Sabbir-Asif/HEAT-Learning-Platform/branches/main/protection --input .github/branch-protection.json
```

### GitHub setup

Issue forms (feature, bug, spike, chore) are in `.github/ISSUE_TEMPLATE/` and the pull request template is `.github/pull_request_template.md`. Labels, milestones and the "HEAT LMS" Project with its fields are kept in `packages/config/src/github-setup.mjs` and applied with the `gh` CLI:

```sh
pnpm github:setup --dry-run   # print the planned changes, make none
pnpm github:setup             # apply them
```

Run the dry run first. It reads only, but it still needs a token that can read this private repository and the Project. The owner of the Project is a user account, which GitHub's fine-grained tokens cannot reach, so use the `gh auth login` token or a classic one:

| Run         | Scopes                                                                          |
| ----------- | ------------------------------------------------------------------------------- |
| `--dry-run` | `repo` and `read:project`                                                       |
| apply       | `repo` and `project` (`gh auth refresh -s project` adds it to a signed-in `gh`) |

It is safe to re-run. It creates what is missing, updates a label's colour and description in place, and never touches issues or project items. It does not delete or rename anything. Extra labels, milestones and options are left alone, and a closed project with the same title is reported instead of duplicated. Adding an option to an existing project field is the one risky write, because the API replaces the whole option list. The script reads the options twice and writes nothing if they changed, prints the current list first so it can be restored, passes every existing option back with its id, and reads the field again afterwards, failing if any option id or name is missing. It exits non-zero when something needs a person, such as a field of the wrong type. The Project Area options are the `area:*` labels, from one list in the script. `packages/config/test/github-setup.test.mjs` tests it against a fake `gh`, with no network or credentials.

### Ticket command

`pnpm ticket` is the GitHub side of the `/implement-issue` skill (`.claude/skills/implement-issue/`), kept in `packages/config/src/ticket.mjs` so the workflow rules are tested code:

```sh
pnpm ticket load 24                          # ticket JSON; exit 3 with the reasons when it may not start
pnpm ticket refine 24 --file refined.md      # append to the issue's "Refined" section and log it
pnpm ticket move 24 start                    # card to In progress, labels set (review: In review)
```

It needs `gh` with the `repo` and `project` scopes. `load` only reads, and keeps only comments from repository collaborators. `refine` never rewrites the owner's text: it appends, reads the body again just before writing and stops if it changed, then reads it back and fails if it is not exactly what was written. GitHub has no compare-and-swap for issue bodies, so an edit in the moment between that last read and the write can still be lost. `packages/config/test/ticket.test.mjs` tests it against a fake `gh`; `packages/config/test/skill.test.mjs` checks the skill and its agents.

### Workflow hooks

`.claude/settings.json` wires eight Claude Code hooks to `node packages/config/bin/hook.mjs <name>`. The logic is in `packages/config/src/hooks/` (Node built-ins only, so it runs before `pnpm install`) and is tested with throwaway git repos, worktrees and a fake `gh`, with no network. The hooks are guard rails for an agent session; branch protection and CI stay the gate (ADR 0010), because a hook can be bypassed through another tool.

| Hook              | Event                     | What it does                                                                                                                                                                                   |
| ----------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context-loader`  | SessionStart              | Prints the branch, issue number, plan path and ticked tasks, offline. On `main` and epic branches it lists the ticket worktrees to resume.                                                     |
| `ticket-injector` | UserPromptSubmit          | For `#N` in a prompt, adds the issue body and the owner, member and collaborator comments as delimited untrusted data. Never blocks the prompt.                                                |
| `branch-guard`    | PreToolUse Edit, Write    | Blocks edits in a checkout on `main`, `master` or a detached HEAD. The repo is taken from the file, not from the session directory.                                                            |
| `plan-gate`       | PreToolUse Edit, Write    | On `<type>/N-slug`, blocks every file but `docs/plans/issue-N.md` until that plan exists. Other branches, such as `epic/*`, are allowed.                                                       |
| `danger-guard`    | PreToolUse Bash and files | Blocks force pushes, `prisma migrate reset`, edits to migrations already on `origin/main` or `origin/epic/*`, shell writes that skip the edit guards, and every read or write of `.env` files. |
| `pr-gate`         | PreToolUse Bash           | Blocks `gh pr create`, `gh pr new` and pull request creation through the API unless the verification marker matches `HEAD` on a clean tree.                                                    |
| `formatter`       | PostToolUse Edit, Write   | Runs ESLint fixes and Prettier on the touched file with the ignore files of `lint` and `format:check`. Skips `docs/`, generated files and images.                                              |
| `stop-check`      | Stop                      | Runs `pnpm typecheck` in the last edited worktree after typed files changed, at most 3 blocks per session, never twice in one turn.                                                            |

The four guards fail closed: malformed input, a crash or a timeout denies. The other four fail open with a one-line note.

`pnpm verify` runs lint, format check, typecheck, coverage tests and build in order and, only if all pass on a clean tree, writes the commit sha to `heat-verified` in the worktree's own git directory (never committed). The PR gate accepts a marker only when it equals `HEAD` and the tree is clean, so any later commit needs another `pnpm verify`. Stage 6 of the skill calls it.

Hook state for the stop check lives in `$HEAT_HOOKS_STATE_DIR` or a private `heat-hooks-<uid>/` directory (mode 0700, owner checked, never a symlink) under the system temp directory, outside every working tree. The plan gate allows editing the hook code and `.claude/settings.json` once the ticket's plan exists; `.github/CODEOWNERS` makes the owner read every change to them. A change to a hook takes effect in sessions started in a checkout that contains it.

`.env` files are also denied by `permissions.deny` for Read and Edit. `.env.example` stays readable.

A glob in a Bash word is denied if it could match an env file name (the text before the first glob character plus `.env` or `.envrc`), so `cat .e*` and `cat prod*` are denied. The one exception is a listing of the real directory, which is trusted only when every condition holds:

- every command in the line is a plain reader from a short allow-list (`cat`, `head`, `tail`, `tac`, `nl`, `less`, `more`, `wc`, `od`, `xxd`, `strings`, `base64`, `md5sum`, `shasum`, `sha256sum`, plus the harmless `echo`, `pwd`, `true`, `ls`, `stat`, `file`, `cmp`), so any other program, `grep`, `diff`, `cd`, a package script or a writer withdraws the trust;
- the line is straight-line: separators are `;` and newline (plus `for NAME in words; do ...; done`), with no `&&`, `||`, `|`, `&`, subshell, group, function, `$(`, backtick, keyword block, wrapper such as `env` or `xargs`, or command whose name is a variable;
- no redirect writes anywhere except to `/dev/null`, `/dev/stdout`, `/dev/stderr` or `/dev/fd/N` (after normalising the path);
- the text has no assignment word (`NAME=`), `export`, `declare`, `typeset`, `unset`, `local`, `readonly` or `HOME`;
- the glob has no `**`, is not under a `~` path, has no `..` after a symlinked directory, and has no directory segment that starts with `.` or `[` and could match `.` or `..` (`.*/`, `.?/`), because some shells expand those.

Then brace lists are expanded, directory parts are listed on disk, every entry is tested including hidden ones and symlink targets, and any entry whose name starts with `.env` counts as an env file, and `cat foo*`, `cat docs/adr/0013*` and `wc -l docs/adr/*` are allowed unless an entry is an env file. `cat *` is denied when one is present. `find`, `rg`, `git`, `tar` and every other program use the name check, so `rg foo docs/adr/0013*` is denied. The listing assumes default shell glob options.

What the hooks cannot do. They cannot protect themselves: an agent that edits `.claude/settings.json` or the hook code, once its plan exists, changes the guards for later sessions, so `.github/CODEOWNERS` (the hook code, `ticket.mjs`, the skill, the agents and every `CLAUDE.md`) and CI are the backstop, and the owner reads those diffs. Writes under `.git`, to any `heat-verified` file and to `.claude/settings.local.json` are denied from every tool. Reads of `.env` files are denied by name; indirection such as variables, globs, interpreters or computed strings can get around the Bash check, which is a limit of reading command text, not something a hook can close. If `node` or `packages/config/bin/hook.mjs` is missing, every guarded tool call is blocked because the guards fail closed; restore the branch, or restart the session from a checkout that has the file.

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
