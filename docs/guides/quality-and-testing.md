# Quality and testing

Lint and styling rules, test layout, integration tests, visual baselines, performance budgets and Storybook. The everyday commands are in the [README](../../README.md#quality-checks).

## Lint and styling rules

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

## Where tests live

Every app and package keeps its tests in a `test/` directory at its root, mirroring the paths under `src/` (`src/health/health.controller.ts` is tested by `test/health/health.controller.test.ts`). Test files end in `.test.ts` or `.test.tsx` and import the code under test from `../src/...`.

This is enforced: the Vitest preset only runs `test/**`, and `packages/config/test/layout.test.mjs` fails if a test file sits anywhere else or an app or package has no `test/` directory. Fixtures and helpers go in `test/` too (for example `test/fixtures/`).

## Integration tests

Integration tests run on real Postgres 17 and Redis 7 in Testcontainers, with no Docker Compose stack, in `packages/db` and `apps/api` (`pnpm -r --if-present run test:integration`; needs Docker, and set `DOCKER_HOST=unix:///var/run/docker.sock` when the Docker Desktop socket is missing). The harness is `packages/db/src/testing`, exported as `@heat/db/testing`.

- Global setup starts both containers once per run, creates one template database and applies the committed migrations to it with `prisma migrate deploy`, so the tests prove the migrations. Testcontainers stops the containers when the run ends, and its Ryuk reaper removes them if the process dies, so a failed run leaves no orphans.
- Isolation is a template clone per test: `useTestDatabase()` (and `useTestApp()` in the API) runs `create database ... template ...` before each test and drops it after. A clone costs tens of milliseconds, tests in one file cannot see each other, and nothing needs truncating. Transaction rollback was rejected because the code under test opens its own transactions and connections. Files that share one database in `beforeAll` can call `withDatabase()` and clean up themselves.
- Redis has no clone, so `useTestRedis()` gives each test a random key prefix and deletes its keys afterwards. Never use `flushall`.
- `createFactories(prisma)` builds users, admins, universities, faculties, departments, students with profiles, courses with a first revision, enrollments (pinned revision and approval decision when approved) and `approvedStudentInPublishedCourse()`. Values are unique, so tests never collide.
- `apps/api/test/support/testing-module.ts` builds the real `AppModule` on the containers: `useTestApp({ controllers, providers, imports })` returns the app, base URL, database, factories and Redis URL, provides `TEST_DATABASE` and `TEST_REDIS_URL`, and sets `DATABASE_URL` and `REDIS_URL`.
- `harness.integration.test.ts` is the self-test: two tests insert the same unique email and both pass.
- The CI `integration` job builds `@heat/db` and `api` first, because the API tests import the compiled harness, and has a 15 minute limit. The suite takes about 20 seconds locally; the limit leaves room for image pulls and a slower runner.

## Visual baselines

`packages/e2e` (`@heat/e2e`) holds the Playwright config and the suites for both apps. They read the route manifests in `apps/*/src/routes/manifest.ts`, so a new route is scanned without editing the suite, and they run against the production `output: "standalone"` build of each app, the same server the deployment runs, started by `packages/e2e/bin/standalone.mjs` (it copies `.next/static` and `public` next to `server.js`, then runs `node server.js` with `PORT` and `HOSTNAME`) on ports 3000 and 3001. No sign-in or API is needed. Besides the screenshot suite, `shell.e2e.ts` checks the bottom bar (five items at 390 px, none at 1440 px), one main landmark, the skip link and the admin drawer focus return, and `robots.e2e.ts` checks `X-Robots-Tag: noindex` on the admin console (page, `/_next/static/` asset and 404) and its absence on the public site.

| Command                  | Runs                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm e2e`               | Both suites on the host, after `pnpm turbo build --filter=frontend-public --filter=frontend-internal`. Needs `pnpm --filter @heat/e2e exec playwright install chromium` once. Screenshots rendered on the host will not match the baselines |
| `pnpm e2e:docker:visual` | The screenshot comparison in the pinned image                                                                                                                                                                                               |
| `pnpm e2e:docker:update` | Regenerates every baseline in the pinned image on any host OS and replaces `packages/e2e/test/*/__screenshots__`                                                                                                                            |

The image is `mcr.microsoft.com/playwright:v1.65.0-noble@sha256:6e3fb709361521eb27161606e6da6d2674e5e89fa16516cb37d6fdd91372273d`, the Playwright 1.65 image (tag and digest). The Playwright version is pinned once in the `catalog:` block of `pnpm-workspace.yaml`; when it changes, change the tag and digest in `packages/e2e/bin/docker.mjs` and here, then regenerate the baselines. `packages/config/test/e2e.test.mjs` fails if they drift apart. The commands copy the tracked files into a work folder inside `packages/e2e`, install and build there as the current user, and need about 4 GB of memory for Docker. pnpm inside the image is installed from the npm tarball and checked against the sha512 in the root `packageManager` field before it is used (the image has no Corepack); `packages/config/test/e2e.test.mjs` covers the check. Update that hash together with the version.

The screenshot suite covers representative pages only, named `{app}-{page}-{width}-{theme}.png`, with animations disabled, the caret hidden, fonts awaited and the `dark` class asserted before capture. Two runs of the same commit in the image differ by zero pixels, so no pixel tolerance is set. Review the changed PNGs in a pull request like any other change.

The screenshot suite is not run in CI; run it locally with the commands above.

## Performance budgets (Lighthouse)

The audit covers pages of the production build (`next build`, then the standalone server on port 3000 through `packages/e2e/bin/standalone.mjs`, no secrets, database or API) with Lighthouse in `packages/e2e/lighthouse`. It runs on every pull request, is not a required check, and never fails the run.

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

## Storybook

`@heat/ui` has a Storybook 10 workbench with the accessibility addon (axe) and the Vitest addon. Stories sit next to their component as `src/**/*.stories.tsx`; the config is in `packages/ui/.storybook/`.

```sh
pnpm --filter @heat/ui storybook                              # dev server on http://localhost:6006
pnpm --filter @heat/ui exec playwright install chromium       # one time: the browser the story tests use
pnpm --filter @heat/ui test:stories                           # every story rendered in Chromium and checked with axe
pnpm --filter @heat/ui build-storybook                        # static build in packages/ui/storybook-static (ignored by git)
```

The toolbar has a theme control (light, dark: the `.dark` class on the story root and on `<html>`). A story pins it with `globals: { theme }`, which locks the toolbar for that story, so each component gets one story for light and one for dark plus a `Default` story that follows the toolbar. The document language is `en`.

An axe violation fails the story test and the output names the rule, for example `button-name`. A story that must accept a known violation sets `parameters.a11y.test` to `"todo"` with a reason. Story tests are not part of `pnpm test` or the coverage gate; run them with `test:stories`.
