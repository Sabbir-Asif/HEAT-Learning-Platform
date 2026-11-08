# Logo assets: implementation plan

**Issue:** #35 (E1, type chore). Branch `chore/35-logo-assets-four-heat`, based on `epic/e1-design-system-and-app-shells`. The `Refined` section of the issue, including the team lead decisions, is the spec.

## Goal

Five SVG logos (HEAT, Government of Bangladesh, University Grants Commission, World Bank, Dhaka University crest) exist as static, sanitised, SVGO-optimised files in both apps' `public/brand/`, with dark variants where the plain file is unreadable on the dark background, Bangla and English alt text in `@heat/i18n`, and a README table naming the source of each file. Checks in tests keep it that way when the owner replaces the vectors.

## Chosen approach

- **One source, generated copies.** Sources (light and dark) live in `packages/config/brand/source/*.svg`. `packages/config/src/brand.mjs` holds the logic (`sanitise`, `optimise`, `legible`, `build`); `packages/config/bin/brand.mjs` is the entry point behind the root script `pnpm brand`. It writes the optimised output byte-identically into `apps/frontend-public/public/brand/` and `apps/frontend-internal/public/brand/`. Both copies are committed so `public/` stays static.
- **Sanitiser by allow-list and grammar.** `sax` in strict mode parses the file; any element or attribute not on the allow-list fails and the message names it. Every attribute value must match an exact grammar: `url(#id)` only in `fill`, `stroke`, `clip-path` and `mask`, transform functions only in `transform` and `gradientTransform`, colour functions only in colour attributes, a `#fragment` for `href`, path commands for `d`, and a plain character set for the rest. A backslash anywhere fails, so CSS escapes cannot hide a URL. Repeated attributes fail (checked on the raw tag, because `sax` silently drops the second one). At most 16 `<use>` elements and 16 levels of nesting. A `viewBox` is required. Sources may be up to 128 KB (raw traces are 26 to 71 KB); shipped files are capped at 20 KB.
- **SVGO** exact-pinned in `@heat/config`, config in `packages/config/svgo.config.mjs`: `preset-default`, `removeScripts`, keep `viewBox`, `width` and `height`, drop metadata, `<title>` and `<desc>`.
- **Rasteriser** `@resvg/resvg-js` exact-pinned: renders without a browser and fetches nothing. It backs the pixel-difference check (optimise changes at most 0.2% of pixels at 512 px) and the legibility check (40 px high, 1x and 2x, over the theme's `--background` read from `packages/ui/src/styles.css`; at most 10% of painted pixels under 3:1 contrast, at least 1% painted).
- **Sources.** The four site files are raster-wrapped (`<image href="data:image/png...">`). The PNGs are decoded in a scratch directory outside the repo and traced with a one-off tool that is not a repo dependency. The README records tool, version and settings. A trace that cannot be made legible within the cap becomes a shape-only placeholder. The crest is a shape-only placeholder with no `<text>`, a hollow shield with `du-crest-dark.svg` as its lighter variant. No mark is redrawn by hand.
- **Targets.** `pnpm brand` lstat-checks every entry in both app directories (and the directory and its parent), refuses symbolic links, and deletes only stray regular `.svg` files. A test checks that every `.svg` under `apps/*/public/` passes the sanitiser. Neither app has a `headers()` config, so `X-Content-Type-Options: nosniff` for `/brand/` is left for the PR note.
- **Alt text.** A `brand` namespace in `@heat/i18n` with typed `en` and `bn` catalogs and keys `brand.logo.heat`, `gob`, `ugc`, `worldBank`, `du`. A test compares both key sets.
- **Turborepo.** `@heat/config#test` and `test:coverage` get inputs covering `apps/*/public/brand/**` and `packages/ui/src/styles.css` so the parity and legibility checks cannot pass from cache.

Alternatives not chosen: SVGO as a build step inside each app (two sources of truth, nothing committed for review); a headless browser for rendering (heavy, fetches).

## Files

| File                                                                          | Change                                       |
| ----------------------------------------------------------------------------- | -------------------------------------------- |
| `packages/config/src/brand.mjs`, `bin/brand.mjs`, `svgo.config.mjs`           | new, logic, entry point, SVGO config         |
| `packages/config/brand/source/*.svg`                                          | new, the sources                             |
| `packages/config/test/brand.test.mjs`, `brand-assets.test.mjs`, `brand-readme.test.mjs`, `test/fixtures/svg/*` | new, sanitiser, optimise, legibility, parity, assets, README |
| `apps/*/public/brand/*.svg`                                                   | new, generated copies                        |
| `packages/i18n/src/messages/{en,bn}/brand.ts`, `src/keys.ts`, `src/index.ts`, `test/keys.test.ts`, `test/messages/brand.test.ts` | new, alt text, key helpers and parity |
| `package.json`, `packages/config/package.json`, `pnpm-lock.yaml`              | `brand` script, dependencies                 |
| `turbo.json`                                                                  | test inputs                                  |
| `README.md`                                                                   | `### Brand assets`                           |

## Tasks

Each task is one commit: failing test first, see it fail for the right reason, least code, tick the box in the same commit.

- [x] **Task 1: sanitiser.** Tests with inline strings: a clean SVG passes; `<script>`, `<foreignObject>`, `<style>`, `<image>`, `<a>`, `<animate>`, `<set>`, `<iframe>`, `<embed>`, `onload=`, `style=`, `data:`, `http:`, `https:`, `//` and `javascript:` values, `url(https://...)`, `<!DOCTYPE`, `<!ENTITY`, a processing instruction, a missing `viewBox`, malformed XML and a file over 20 KB each fail with the construct named; a `#fragment` `href` passes. The raster-wrapped site file is a fixture that fails naming `<image>` and `data:`. Then `src/brand.mjs` `sanitise` and the `sax` dev dependency.
- [x] **Task 2: SVGO config and `optimise`.** Tests: output is strictly smaller on a verbose fixture, identical on a second run, within 0.2% pixel difference at 512 px, `url(#id)` references survive. Then `@resvg/resvg-js`, `svgo`, `svgo.config.mjs` and `optimise`. Check pnpm 11 `allowBuilds` and `minimumReleaseAge`; report, do not silently exclude.
- [x] **Task 3: `pnpm brand` and parity.** Tests: building into temp app directories writes identical bytes to both; a stray, missing or hand-edited file fails and names it; a second run changes nothing. Then `bin/brand.mjs`, the root script and a `build` function.
- [x] **Task 4: legibility check.** Tests: dark-on-dark fixture fails, the same with a light fill passes, an empty file fails, the theme backgrounds come from `styles.css`. Then `legible`.
- [x] **Task 5: the assets.** Tests over the real tree: every source passes the sanitiser, is under the cap, optimises smaller, is legible in light and dark with the `-dark` file where required, and both app directories equal `optimise(source)`. Then trace, write sources, add dark variants only where the check needs them, run `pnpm brand`.
- [x] **Task 6: alt text.** Test in `@heat/i18n`: `en` and `bn` define the same five keys, non-empty, missing key named. Then `messages/{en,bn}/brand.ts` and the export.
- [x] **Task 7: README and Turborepo inputs.** Test: every file in `source/` has a row in the `### Brand assets` table with source, status and date, and the section says the owner's vectors replace the files before launch. Then the README section and `turbo.json` inputs.

## Review follow-ups

- [x] **Task 8: sanitiser grammar, repeats and limits** (security review). Backslash rejected, exact value grammars, repeated attributes, 16 `<use>` and 16 levels.
- [x] **Task 9: target safety.** Symbolic links refused, only `.svg` files deleted, repo-wide public SVG check.
- [x] **Task 10: legibility.** Enclosed blank-paper rule, `minContrast` option, `du-crest-dark.svg` at 3:1, README thresholds, SHA-256 of the source PNGs.
- [x] **Task 11: i18n tests.** Key helper tests in `test/keys.test.ts`.

## Acceptance criteria mapped to checks

| Criterion (refined)                                                          | Check                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------- |
| Every SVG passes the sanitiser                                               | Task 1 tests, Task 5 tests over the real tree |
| Raster-wrapped site file fails naming `<image>` and `data:`; each construct  | Task 1 fixtures                               |
| Optimised is smaller, within the pixel limit, idempotent                     | Task 2 and Task 5 tests                       |
| Legible at header size in light and dark                                     | Task 4 and Task 5 tests; contact sheet viewed |
| Both apps hold byte-identical `optimise(source)`; stray or missing is named  | Task 3 and Task 5 tests                       |
| `en` and `bn` define the same five keys                                      | Task 6 test                                   |
| README row per source with source, status, date; owner replacement statement | Task 7 test                                   |
| Lint, format, typecheck, coverage and build pass, no comments                | `pnpm verify`                                 |

## Verification

```sh
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build
pnpm audit:deps
pnpm brand && git status --short
pnpm verify
```

Visual check: the final SVGs rendered at 40 px high in light and dark onto a contact sheet in the scratch directory (not committed) and inspected by eye.
