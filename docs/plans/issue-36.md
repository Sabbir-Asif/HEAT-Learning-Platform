# next-intl setup: implementation plan

**Issue:** #36 (E1, type feat). Branch `feat/36-next-intl-setup-bn`, based on `epic/e1-design-system-and-app-shells`. The `Refined` section of the issue, including the team lead decisions, is the spec.

## Goal

`frontend-public` serves every page under `/bn/...` or `/en/...`. `GET /` is the only path that redirects, to the language chosen from the `__Host-locale` cookie, then `Accept-Language`, then Bangla. The root layout sets `<html lang>` from the segment, messages come from the typed `@heat/i18n` catalogs, dates print in Asia/Dhaka time, and a `LocaleSwitch` in `@heat/ui` swaps the first segment and remembers the choice. A catalog that drifts between languages fails `pnpm test`.

## Chosen approach

- **Pure logic in `@heat/i18n`.** `locale.ts` (`LOCALES`, `DEFAULT_LOCALE = "bn"`, `LOCALE_COOKIE = "__Host-locale"`, `isLocale`), `negotiate.ts` (`negotiateLocale({ cookie, acceptLanguage })`, a hand-written `Accept-Language` parser reading at most 32 entries and 1 KB, no regex backtracking), `switchLocalePath`, `serializeLocaleCookie`. Everything is unit tested without Next.
- **Own `proxy.ts`, not `next-intl/middleware`.** The matcher is `["/"]` and the function returns early for any other pathname. It answers 307 with `Location: /<locale>` plus the original query, `Cache-Control: private, no-store` and `Vary: Accept-Language, Cookie`. It never sets a cookie and never echoes a request header. next-intl supplies `getRequestConfig`, the provider, `useTranslations` and `getTranslations`.
- **Routing.** `src/app/[locale]/layout.tsx` is the root layout (`generateStaticParams`, `notFound()` for an unknown first segment, `<html lang dir="ltr">`), `[locale]/page.tsx` the placeholder home, both reading the `site` namespace. `src/i18n/request.ts` reads `locale()` from `next/root-params`, validates with `hasLocale`, sets `timeZone: "Asia/Dhaka"`, and defines `onError` and `getMessageFallback` so a missing key logs and does not crash. `next.config.ts` is wrapped with `createNextIntlPlugin`. `src/global.d.ts` declares `AppConfig` so keys are typed. `/bn` and `/en` stay static.
- **Catalogs.** `messages/en/index.ts` aggregates namespaces; `messages/bn/index.ts` is `satisfies typeof en`; `messages` becomes `{ en, bn }`. `flattenKeys` and `compareKeys` stay the engine of `test/messages/parity.test.ts`, which discovers namespace files on disk and checks keys, non-empty values, `{placeholder}` names and that every file is exported by the aggregate. A small `site` namespace (title, home heading, `localeSwitch.label`) is added; `brand` is kept.
- **Dates.** `dates.ts` with `formatDate`, `formatDateTime`, `formatTime` using date-fns `format(..., { in: tz("Asia/Dhaka"), locale })` and a Bengali digit mapping for bn. An invalid date throws `RangeError`. Tests run under `TZ=UTC` and `TZ=America/New_York` through child-process runs controlled by the test itself, so no comment or pragma is needed.
- **`LocaleSwitch` in `@heat/ui`.** `packages/ui/src/locale-switch/` with props `{ label, current, options: { value, label, href }[], onChange? }`, rendered as a `<nav>` with an accessible name and an `<a>` per option (`lang`, `hreflang`, endonym text, `aria-current` on the current one). It imports nothing from next-intl, Next or `@heat/i18n`. The app glue is one markup-free client file that builds hrefs from `usePathname()` with `switchLocalePath`, writes the cookie with `serializeLocaleCookie` and navigates with `window.location.assign` (a full navigation, because the root layout changes), appending the query and hash.
- **Playwright bootstrap.** `@playwright/test` 1.65.0 in `frontend-public`, `playwright.config.ts` (one Chromium project, `webServer` running `next build` then the standalone server with `.next/static` and `public` copied in), specs in `test/e2e/*.spec.ts` (the layout test allows `apps/*/test/`). `turbo.json` gets a `test:e2e` task; `ci.yml` gets an `e2e` job modelled on `storybook`, not a required check.
- **Dependencies.** next-intl 4.14.9 (`frontend-public`), date-fns 4.4.0 and @date-fns/tz 1.5.0 (`@heat/i18n`), @playwright/test 1.65.0 (`frontend-public`), all exact. `pnpm-workspace.yaml` sets `allowBuilds` to `false` for `@parcel/watcher` and `@swc/core`. The release-age rule is checked for each new package and nothing is excluded silently.
- **Admin app untouched.** Optional test that `frontend-internal` has no `proxy.ts`, no `[locale]` and no next-intl dependency.

Alternatives not chosen: `next-intl/middleware` (hides the redirect rules and sets its own cookie and `Link` headers); a redirect for every unprefixed path (the spec limits it to `/`); `Intl.DateTimeFormat` for dates (digit and time zone behaviour differs by ICU build).

## Files

| File                                                                                               | Change                                                          |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/i18n/src/{locale,negotiate,switch-locale-path,cookie,dates,index}.ts`, `src/messages/**` | new and changed, pure logic, catalogs                           |
| `packages/i18n/test/**`                                                                            | new, unit tests and catalog parity                              |
| `packages/i18n/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`                              | date-fns, @date-fns/tz, `allowBuilds`                           |
| `apps/frontend-public/src/app/[locale]/**`, `src/i18n/request.ts`, `src/proxy.ts`, `src/global.d.ts` | new, routing, request config, proxy, typing                     |
| `apps/frontend-public/src/components/locale-switch-client.tsx`                                     | new, markup-free glue                                           |
| `apps/frontend-public/{next.config.ts,package.json,playwright.config.ts,test/**}`                  | plugin, dependencies, Playwright, unit and e2e tests            |
| `packages/ui/src/locale-switch/**`, `packages/ui/src/index.ts`, `packages/ui/src/styles.css`       | new, component, story, styles, export                           |
| `turbo.json`, `.github/workflows/ci.yml`                                                           | `test:e2e` task, `e2e` job                                      |
| `README.md`, `apps/frontend-public/CLAUDE.md`                                                      | cookie, redirect rules, Playwright, `allowBuilds`, conventions  |

## Tasks

Each task is one commit: failing test first, see it fail for the right reason, least code, tick the box in the same commit. Push after each part.

### Part A: `@heat/i18n`

- [x] **A1: locale constants.** Tests: `LOCALES` is `["bn", "en"]`, `DEFAULT_LOCALE` is `bn`, `isLocale` accepts exactly `bn` and `en` (rejects `BN`, `fr`, empty, non-string). Then `locale.ts`.
- [x] **A2: `negotiateLocale`.** Tests: cookie `bn` or `en` wins over the header; a cookie of `fr`, `BN`, empty, `bn;x` or over 16 characters is ignored; q-values (`en;q=0.8, bn;q=0.9` goes to bn); `bn-BD`, `bn-IN`, `EN-us` match on the primary subtag, any case; `en;q=0`, `en;q=abc`, `q` above 1 and `q=` with more than three decimals are ignored; equal q: first listed wins; `fr`, `*`, empty, absent and junk go to bn; 32-entry and 1 KB caps (an `en` beyond the cap is not seen); a 1 MB header and a pathological `;;;;` string finish in milliseconds. Then `negotiate.ts`.
- [x] **A3: `switchLocalePath`.** Tests: `/en`, `/en/`, `/bn/x?y=1#z`, `/x`, `//evil.com`, `/\evil.com`, `/en//evil.com`, `javascript:alert(1)`, empty, a path with a control character; the result always starts with `/<target>` and holds no `//`, scheme or backslash. Then `switch-locale-path.ts`.
- [x] **A4: `serializeLocaleCookie`.** Tests: exact string `__Host-locale=bn; Path=/; Max-Age=31536000; SameSite=Lax; Secure`, no `Domain`, no `HttpOnly`; a value that is not a locale throws. Then `cookie.ts`.
- [x] **A5: catalog aggregates and parity.** Tests: `messages` is `{ en, bn }` with `brand` and `site`; parity names `missing: ["..."]`, `extra`, empty values, placeholder mismatches (`{name}` vs `{nome}`) and a namespace file present in one language only or not exported by the aggregate, each with its key or file; reconcile `keys.ts` and the #35 brand test to the new aggregate. Then `messages/{en,bn}/{site,index}.ts` and `index.ts`.
- [x] **A6: dates.** Tests under `TZ=UTC` and `TZ=America/New_York`: `2026-11-07T20:30:00Z` prints 8 November 2026, 02:30 in en and bn; bn uses Bengali digits and bn month names, en uses ASCII digits; an invalid `Date` throws `RangeError`. Then `dates.ts`, date-fns and @date-fns/tz, `allowBuilds` check.

### Part B: `frontend-public`

- [x] **B1: dependencies.** `next-intl` 4.14.9 and `allowBuilds` for `@parcel/watcher` and `@swc/core`; `pnpm install --frozen-lockfile` and `pnpm build` still work; release-age findings recorded.
- [x] **B2: proxy.** Unit tests with `NextRequest`: every redirect criterion (status, `Location`, `Cache-Control`, `Vary`, query byte for byte, cookie and header precedence), pass-through for `/bn`, `/en/x`, `/sign-in`, `/_next/static/x.js`, `/api/revalidate`, `/brand/heat.svg`, `/favicon.ico`, no `Set-Cookie`, no echo of `Host` or `Accept-Language` with CR, LF or a URL. Then `src/proxy.ts`.
- [x] **B3: routing and request config.** Tests: `request.ts` returns messages and `Asia/Dhaka` for a valid locale, `notFound()` for others, `onError` and `getMessageFallback` log and do not throw; `generateStaticParams` lists bn and en; `next-config.test.ts` still passes with the plugin. Then `[locale]/layout.tsx`, `page.tsx`, `request.ts`, `global.d.ts`, `next.config.ts`; delete the old layout and page.
- [x] **B4: Playwright bootstrap.** Specs: `/` with `Accept-Language: en-US,en;q=0.9` lands on `/en` with `lang="en"`; no header or `fr` lands on `/bn`; cookie `bn` wins; `/fr`, `/BN` and `/sign-in` are 404; `/brand/heat.svg` is 200 without a redirect; `/bn` and `/en` carry the catalog heading. Then `playwright.config.ts`, the `test:e2e` script, `turbo.json` and the `e2e` CI job.
- [x] **B5: size.** Record the first-load JS of `/[locale]` (gzip) from the build; stays within 150 KB.

### Part C: `LocaleSwitch` and glue

- [x] **C1: component.** Stories (light, dark, bn, en) with play functions: `<nav>` with accessible name, `<a lang hreflang>` with endonym, `aria-current` on the current option, Tab then Enter activates the other option and calls `onChange`, each link is at least 24 by 24 CSS px, fits at 360 px; axe passes. Unit test of the markup. Then `locale-switch.tsx`, styles, root export.
- [x] **C2: app glue.** Tests with jsdom: the click handler writes the cookie, preserves path, query and hash, and calls `window.location.assign` with `/bn/courses/x?tab=2#notes` from `/en/courses/x?tab=2#notes`. Then the client glue file and an e2e spec of the switch.
- [ ] **C3: docs.** README (cookie, redirect rules, Playwright, `allowBuilds`, CI `e2e` job) and `apps/frontend-public/CLAUDE.md` (i18n conventions). Docs tests stay green.

## Acceptance criteria mapped to checks

| Criterion (refined)                                                                     | Check                                                  |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `/` redirects by cookie, then `Accept-Language`, then bn; headers; query kept           | A2, B2 unit tests; B4 e2e                              |
| Hostile `Host` and `Accept-Language` never appear in the response                       | B2 tests                                               |
| Every other path passes through unchanged                                               | B2 tests; B4 brand SVG 200                             |
| `<html lang>` from the segment, `dir="ltr"`, title and heading from the catalog         | B3 tests; B4 e2e                                       |
| `/fr`, `/BN`, `/sign-in` return 404                                                     | B3 tests; B4 e2e                                       |
| `/bn` and `/en` are prerendered                                                         | `pnpm build` route table (B5)                          |
| Switch keeps path, query and hash and stores the cookie                                 | C2 tests; B4/C2 e2e                                    |
| Cookie attributes and value                                                             | A4 tests                                               |
| `switchLocalePath` never returns `//`, a scheme or a backslash                          | A3 tests                                               |
| `LocaleSwitch` markup, keyboard, axe, 360 px, 24 px targets, focus ring                 | C1 stories and unit test                               |
| Catalog parity fails and names the key or file                                          | A5 tests                                               |
| Dates in Asia/Dhaka, Bengali digits in bn, `RangeError`                                 | A6 tests under two time zones                          |
| `frontend-internal` unchanged                                                           | optional test in `frontend-internal/test`              |
| First-load JS within 150 KB gzipped                                                     | B5 build output, recorded in the PR                    |
| Lint, format, typecheck, coverage and build pass, no comments                           | `pnpm verify`                                          |

## Verification

```sh
pnpm install --frozen-lockfile
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build
pnpm audit:deps
pnpm --filter frontend-public exec playwright install chromium
pnpm --filter frontend-public test:e2e
pnpm --filter @heat/ui build-storybook && pnpm --filter @heat/ui test:stories
pnpm generate && git status --short
pnpm verify
```

Manual check against the built app: `curl -si` on `/` with different `Accept-Language` and `Cookie` headers, on `/fr`, `/bn` and `/en`, and the `lang` attribute of each page; Playwright CLI screenshots of `/bn` and `/en` in the scratch directory (not committed).
