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
  config/     tsconfig, ESLint, Prettier and Vitest presets; repository scripts (audit:deps, brand, github:setup, ticket)
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

### Accessibility and visual baselines

`packages/e2e` (`@heat/e2e`) holds the Playwright config and two suites for both apps. They read the route manifests in `apps/*/src/routes/manifest.ts`, so a new route is scanned without editing the suite, and they run against the production `output: "standalone"` build of each app, the same server the deployment runs, started by `packages/e2e/bin/standalone.mjs` (it copies `.next/static` and `public` next to `server.js`, then runs `node server.js` with `PORT` and `HOSTNAME`) on ports 3000 and 3001. No sign-in or API is needed. Besides the axe and screenshot suites, `shell.e2e.ts` checks the bottom bar (five items at 390 px, none at 1440 px), one main landmark, the skip link and the admin drawer focus return, and `robots.e2e.ts` checks `X-Robots-Tag: noindex` on the admin console (page, `/_next/static/` asset and 404) and its absence on the public site.

| Command                  | Runs                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm e2e`               | Both suites on the host, after `pnpm turbo build --filter=frontend-public --filter=frontend-internal`. Needs `pnpm --filter @heat/e2e exec playwright install chromium` once. Screenshots rendered on the host will not match the baselines |
| `pnpm e2e:a11y`          | The axe suite on the host                                                                                                                                                                                                                   |
| `pnpm e2e:docker:a11y`   | The axe suite in the pinned image, as CI runs it                                                                                                                                                                                            |
| `pnpm e2e:docker:visual` | The screenshot comparison in the pinned image, as CI runs it                                                                                                                                                                                |
| `pnpm e2e:docker:update` | Regenerates every baseline in the pinned image on any host OS and replaces `packages/e2e/test/*/__screenshots__`                                                                                                                            |

The image is `mcr.microsoft.com/playwright:v1.65.0-noble@sha256:6e3fb709361521eb27161606e6da6d2674e5e89fa16516cb37d6fdd91372273d`, the Playwright 1.65 image (tag and digest). The Playwright version is pinned once in the `catalog:` block of `pnpm-workspace.yaml`; when it changes, change the tag and digest in `packages/e2e/bin/docker.mjs` and here, then regenerate the baselines. `packages/config/test/e2e.test.mjs` fails if they drift apart. The commands copy the tracked files into a work folder inside `packages/e2e`, install and build there as the current user, and need about 4 GB of memory for Docker. pnpm inside the image is installed from the npm tarball and checked against the sha512 in the root `packageManager` field before it is used (the image has no Corepack); `packages/config/test/e2e.test.mjs` covers the check. Update that hash together with the version.

The accessibility suite scans every manifest route at 390 and 1440 px, light and dark (the emulated colour scheme sets the theme), with the axe tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`. Axe has no WCAG 2.2 level A tag, so the 2.2 AA rules are the new ones. A failure prints the rule id, the impact and the selector. It also exercises the theme switch once per app, scans the open admin navigation sheet at phone width, and checks that the first tab stops of each layout show a focus indicator. Do not silence a rule with `disableRules`; fix the page or open an issue.

The screenshot suite covers representative pages only, named `{app}-{page}-{width}-{theme}.png`, with animations disabled, the caret hidden, fonts awaited and the `dark` class asserted before capture. Two runs of the same commit in the image differ by zero pixels, so no pixel tolerance is set. Review the changed PNGs in a pull request like any other change.

Two CI jobs run on every pull request: `accessibility` is a required check, `screenshots` is not. The screenshot job never fails the run; it writes a `::warning` annotation and a job summary naming the changed screens and uploads actual, expected and diff images as the `screenshot-diffs` artifact for 7 days.

### Performance budgets (Lighthouse)

The `lighthouse` job audits pages of the production build (`next build`, then the standalone server on port 3000 through `packages/e2e/bin/standalone.mjs`, no secrets, database or API) with Lighthouse in `packages/e2e/lighthouse`. It runs on every pull request, is not a required check, and never fails the run.

| Budget                               | Limit                                            |
| ------------------------------------ | ------------------------------------------------ |
| First-load JavaScript, public pages  | 300 KB gzipped                                   |
| First-load JavaScript, learner pages | 200 KB gzipped, excluding the player chunk       |
| Largest Contentful Paint             | 2.5 s on mobile with Slow 4G and 4x CPU slowdown |

First-load JavaScript is the sum of the transfer size of every script request Lighthouse records during the first load, as Next serves it with gzip; that includes response headers. Each page is audited 3 times and the median is judged. A breach, a script request matching `playerChunkPattern` on a page that does not set `allowsPlayer`, or a run that crashes or times out becomes a `::warning` annotation and a job summary naming the page, the budget and the measured value. The HTML and JSON reports are the `lighthouse-reports` artifact for 7 days, also when the run fails.

`packages/e2e/lighthouse/config.json` holds the budgets and the audited pages. To audit another page, add one entry to `pages` with `path`, `kind` (`public` or `learner`) and `app`; set `allowsPlayer` on lesson pages. The workflow does not change. Entries that need sign-in (`auth`) are not supported by the runner yet. Only `/` of `frontend-public` is audited today, and the learner budget is configured but unused.

```sh
pnpm turbo build --filter=frontend-public
pnpm --filter @heat/e2e lighthouse
pnpm --filter @heat/e2e lighthouse:report
```

Run it after `pnpm --filter @heat/e2e exec playwright install chromium`. Reports land in `packages/e2e/lighthouse-results`.

### Storybook

`@heat/ui` has a Storybook 10 workbench with the accessibility addon (axe) and the Vitest addon. Stories sit next to their component as `src/**/*.stories.tsx`; the config is in `packages/ui/.storybook/`.

```sh
pnpm --filter @heat/ui storybook                              # dev server on http://localhost:6006
pnpm --filter @heat/ui exec playwright install chromium       # one time: the browser the story tests use
pnpm --filter @heat/ui test:stories                           # every story rendered in Chromium and checked with axe
pnpm --filter @heat/ui build-storybook                        # static build in packages/ui/storybook-static (ignored by git)
```

The toolbar has a theme control (light, dark: the `.dark` class on the story root and on `<html>`). A story pins it with `globals: { theme }`, which locks the toolbar for that story, so each component gets one story for light and one for dark plus a `Default` story that follows the toolbar. The document language is `en`.

An axe violation fails the story test and the output names the rule, for example `button-name`. A story that must accept a known violation sets `parameters.a11y.test` to `"todo"` with a reason. Story tests are not part of `pnpm test` or the coverage gate; they run in `test:stories` and in the `storybook` CI job.

### Design file and theme

The Open Pencil designs, the theme and the screen inventory live in `docs/design/` (see its README). Two checks run over them, and `packages/config/test/design-files.test.mjs` runs both in `pnpm test`:

```sh
pnpm design:contrast   # every colour pair in light and dark with its WCAG 2 ratio; exits 1 on any failure
pnpm design:check      # token structure, contrast, inventory against exports, drawer-only overlays
```

`packages/ui/src/styles.css` is the Tailwind theme built from `docs/design/tokens.json`. Change both together: `packages/ui/test/tokens.test.ts` fails when a value drifts, and `contrast.test.ts` checks every contrast pair in both themes. Each app has one CSS entry, `src/app/globals.css`, that imports `@heat/ui/styles.css` and scans `packages/ui/src`. The theme follows the device setting through `ThemeProvider` (next-themes, `dark` class on `<html>`); a visible switch comes with the shells. The inline script next-themes adds, and the style element it injects on each theme change (`disableTransitionOnChange`), are covered by the CSP of ADR 0019 (hashes on cached pages, a nonce on dynamic pages), so `ThemeProvider` needs no change. Storybook shows every token in light and dark on Foundations, Tokens.

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

### Brand assets

The logos are static SVG files served at `/brand/<name>.svg` by both frontends. One source of truth feeds both apps: `packages/config/brand/source/*.svg` is run through SVGO (`packages/config/svgo.config.mjs`) and written byte for byte into `apps/frontend-public/public/brand/` and `apps/frontend-internal/public/brand/`. Both copies are committed, so `public/` stays static.

```sh
pnpm brand            # sanitise, optimise and write both copies; a second run changes nothing
pnpm brand --check    # exit 1 and name any missing, stray or hand-edited file
```

To replace a mark, drop the new vector into `packages/config/brand/source/` under the same name, run `pnpm brand` and commit the source and both copies. Do not edit the copies by hand. `<name>-dark.svg` is used on the dark theme and exists only where the plain file fails the legibility check. Choosing the file by theme belongs to the shells.

`packages/config/test/brand.test.mjs` and `brand-assets.test.mjs` enforce the rules:

- Sanitiser: strict XML parse plus an allow-list (`svg g path rect circle ellipse line polyline polygon defs linearGradient radialGradient stop clipPath mask use`). Every attribute has an exact grammar: `fill` and `stroke` take a colour (keyword, `#hex`, `rgb`, `rgba`, `hsl`, `hsla`) or `url(#id)`; `clip-path` and `mask` take `none` or `url(#id)`; `transform` and `gradientTransform` take only transform functions; `href` is a `#fragment`; `d` holds path commands and numbers; every other attribute is letters, digits, spaces and `. , % + - #`. A backslash anywhere in a value fails (CSS escapes such as `u\72l(` cannot hide a URL), so does any other `(`, a repeated attribute, a `<script>`, `<foreignObject>`, `<style>`, `<image>`, `<text>`, an `on*` or `style` attribute, `data:`, `http:`, `https:` or `//`, `<!DOCTYPE`, `<!ENTITY` or a processing instruction, and the message names it. A `viewBox` is required. Text and `<style>` classes must be converted to outlines and presentation attributes. At most 16 `<use>` elements and 16 levels of nesting, so a chain of references cannot multiply into a render bomb. Sources may be up to 128 KB; shipped files are capped at 20 KB.
- Every `.svg` under `apps/*/public/` passes the sanitiser, not only `public/brand/`. `pnpm brand` refuses a symbolic link or a directory named `*.svg` in a target and deletes only stray regular `.svg` files; `--check` reports any other stray file.
- Optimisation: each shipped file is strictly smaller than its source, differs from it in at most 0.2% of pixels (channel difference over 8, both rendered at 512 px with `@resvg/resvg-js`) and is unchanged by a second run.
- Legibility: each file is rendered 40 px high at 1x and 2x over the `--background` of its theme, read from `packages/ui/src/styles.css`. A pixel with at least half opacity is painted and is judged by its own colour, not its anti-aliased blend. At least 1% of the canvas must be painted and at most 10% of the painted pixels may have contrast under 2:1 (3:1 for the `du-crest` placeholder, which is ours). On the light theme a pale pixel (under 1.5:1) counts as blank paper only when ink encloses it, found by flood fill from the transparent outside; pale pixels connected to the outside count as low contrast, so a pale wordmark beside a dark shape fails. WCAG exempts logotypes from the text contrast rule, so 2:1 is an interim bar for the partner marks, not a claim of 3:1: the HEAT bars measure 2.78 to 3.15:1 on the dark background and the GoB seal's orange map is about 2.3:1 on white. The owner may tighten it once the original vectors arrive. The check says nothing about whether the small tagline or the fine print in the seal can be read at 40 px; they cannot, which is why the names live in the alt texts. If `--background` moves out of hex (#31), update `readThemeBackgrounds` with it.

| File                  | Organisation                                           | Source                                                                                                                                          | Status      | Date       |
| --------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| `heat.svg`            | HEAT, Higher Education Acceleration and Transformation | `logo.svg` on heat.ugc.gov.bd, 1000 px PNG, sha256 `36d1925b0ca4e0006c7c0ece9eba6e1797d81fc67939a06a702e9ec7ed89871e`, traced to vectors        | traced      | 2026-11-08 |
| `heat-dark.svg`       | HEAT                                                   | `heat.svg` with near-black and navy fills recoloured to `#e5e7eb`                                                                               | traced      | 2026-11-08 |
| `gob.svg`             | Government of the People's Republic of Bangladesh      | `right-logo1.svg` on heat.ugc.gov.bd, 1000 px PNG, sha256 `b60133e7abd0cac1063844aa75f6b54c16f243bfe425a40129728685c72b0075`, traced to vectors | traced      | 2026-11-08 |
| `ugc.svg`             | University Grants Commission                           | `right-logo2.svg` on heat.ugc.gov.bd, 1000 px PNG, sha256 `dea8b7970ae3d029398608b13144fa700a7c4c763bd5d469ae780db3dfa27ce4`, traced to vectors | traced      | 2026-11-08 |
| `ugc-dark.svg`        | University Grants Commission                           | `ugc.svg` with near-black and navy fills recoloured to `#e5e7eb`                                                                                | traced      | 2026-11-08 |
| `world-bank.svg`      | The World Bank                                         | `right-logo3.svg` on heat.ugc.gov.bd, 500 px PNG, sha256 `feb950613bdf58e1520488b9cab3d3c483e340714594e53d904df00834c7e5e8`, traced to vectors  | traced      | 2026-11-08 |
| `world-bank-dark.svg` | The World Bank                                         | `world-bank.svg` with near-black and navy fills recoloured to `#e5e7eb`                                                                         | traced      | 2026-11-08 |
| `du-crest.svg`        | University of Dhaka                                    | Generic shield, shapes only; no usable source for the crest exists yet                                                                          | placeholder | 2026-11-08 |
| `du-crest-dark.svg`   | University of Dhaka                                    | `du-crest.svg` with a lighter blue, so the placeholder reaches 3:1 on the dark theme                                                            | placeholder | 2026-11-08 |

The files on heat.ugc.gov.bd (downloaded 2026-11-08) are SVG in name only: each wraps one embedded PNG in an `<image>` with a `data:` URI, which the sanitiser rejects. The sha256 sums in the table are of the decoded PNGs. The PNGs were decoded and traced once, outside the repository, with `vtracer` 0.6.15 (Python binding, Pillow 13.0.0 for preparation); the tool is not a dependency. Preparation: alpha cut at 128, cropped to the painted area, colours reduced with Pillow's median cut and no dithering (`heat` 6 colours, `gob` 8, `ugc` 6, `world-bank` 8). Tracing: colour mode, `hierarchical="stacked"`, `mode="spline"`, `color_precision=8`, `layer_difference=24`, `path_precision=0`, `corner_threshold=60`, `length_threshold=8`, `splice_threshold=60`, `filter_speckle=10` (20 for `ugc`). The `-dark` files change only fill colours, by script. No mark was redrawn by hand. The HEAT mark, the text in the seal and the UGC mark are image art, so their names live in the alt texts where each logo is used.

The GoB seal, the UGC mark and the World Bank mark are third-party marks. These traced files are interim: the owner's original vectors replace these files before launch, and the usage terms of each mark stay with its owner. `du-crest.svg` is a placeholder and not the University of Dhaka crest.

### Continuous integration

Pull requests and pushes to `main` run these checks in GitHub Actions; each is a required status check:

| Check                                          | Runs                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `lint`, `format`, `typecheck`, `test`, `build` | The matching root script through Turborepo (`test` runs coverage)    |
| `integration`                                  | `test:integration` in any package that defines it (Testcontainers)   |
| `audit`                                        | `pnpm audit:deps`, also weekly; fails on high or critical advisories |

The `storybook` job is separate and not yet a required check: it runs the story tests with axe and builds static Storybook, and uploads it as the `storybook-static` artifact (7 days, also when the tests fail). It runs on every pull request. The owner adds it to `.github/branch-protection.json` and re-applies the protection.

The `accessibility` check runs the axe suite for both apps and is required; `.github/branch-protection.json` lists it, so re-apply the protection after merging. The `screenshots` job is not required. See Accessibility and visual baselines.

The `lighthouse` job is separate and not a required check: it audits the production build against the performance budgets and only warns. See Performance budgets (Lighthouse).

The `api-client-drift` job is separate and not yet a required check either. It builds contracts and the API, regenerates `apps/api/openapi.json` and `packages/api-client/src/generated/`, and fails when any file differs from what is committed (modified, deleted or new), listing the files. Run `pnpm generate` and commit the result to fix it.

Dependabot runs from `.github/dependabot.yml` and bumps SHA-pinned actions without needing a version comment (npm, GitHub Actions and the dev compose images; app Dockerfiles are added with the deployment tickets). CodeQL is left out: GitHub only stores its results for a private repository with code security enabled. Add it back if the repository goes public or code security is bought. In CI, Turborepo's cache lives in `.turbo` and is restored per task, so unchanged packages replay instead of re-running.

Workflow rules, enforced by `packages/config/test/workflows.test.mjs`: every external action is pinned to a commit SHA with no trailing version comment (comments are not allowed in workflow files), each workflow sets `permissions`, and `pull_request_target` is not used.

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
- `contracts` and `db` compile to `dist/` because the API imports them; `ui` and `api-client` ship TypeScript source and are compiled by the Next.js apps (`transpilePackages`).
- The worker imports the API's shared modules from `api/core`.
