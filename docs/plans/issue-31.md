# Design tokens as the `@heat/ui` Tailwind theme: implementation plan

**Issue:** #31 (E1, size M, type feature, area ui). Branch `feat/31-design-tokens-as-heat`, based on `epic/e1-design-system-and-app-shells`. The `Refined` section of the issue is the spec: English only, light frames approved, dark set derived in `docs/design/tokens.json`.

## Goal

`@heat/ui/styles.css` becomes the single Tailwind 4 theme for both apps: every colour role, type style, radius, spacing step, shadow and chart colour from `docs/design/tokens.json`, in light and dark, with self-hosted Source Serif 4 and Public Sans and a `next-themes` provider mounted in both root layouts. A Storybook Tokens page shows all of it. Base components (E1-3), lint rules (E1-5) and the visible theme switch (E1-8) stay out.

## Chosen approach

- **Hand-written `styles.css`, checked by a test against `tokens.json`.** A generator would add a build step and a second source of truth to maintain. Instead the stylesheet is written once (values copied from the export by a throwaway script kept in the scratchpad) and `test/tokens.test.ts` proves the match, so any later drift in either file fails CI.
- **Structure of the stylesheet:** `@import "tailwindcss"`, font imports, `@theme` holding `--color-*: initial` plus the fixed tokens (type scale, radius, spacing, fonts), `:root` and `.dark` holding the per-theme variables (colours and shadows), and `@theme inline` mapping `--color-<role>` to `var(--<role>)` and `--shadow-<size>` to the per-theme shadow variables. `@custom-variant dark (&:where(.dark, .dark *))` makes `dark:` follow the class, the same class Storybook's decorator toggles.
- **No Tailwind default colours:** `--color-*: initial` in `@theme`, per the owner decision.
- **Parsing in tests:** a small brace-aware block reader in `test/support/css.ts` (the existing regex over `[^}]*` breaks on nested rules). It returns the declarations of `:root`, `.dark` and `@theme` blocks.
- **Contrast:** `contrastRatio` from `@heat/config` (plain hex) over `tokens.json` `pairs`, with values read from the parsed `styles.css`, both themes, text 4.5:1, non-text 3:1, `disabled` exempt. Focus ring 3:1 on `background` and `card` is already in `pairs` (`ring/background`, `ring/card`) and gets its own named assertion.
- **Tailwind output test:** compile `styles.css` with the `compile` API from `tailwindcss` and assert the candidates `bg-primary`, `text-muted-foreground`, `bg-status-success`, `rounded-lg`, `shadow-md`, `font-display` produce rules using the token variables, and `bg-red-500` produces nothing.
- **Fonts:** `@fontsource-variable/source-serif-4` and `@fontsource-variable/public-sans`, Latin subset files only, imported from `styles.css` so both apps and Storybook get the same `@font-face` rules with `font-display: swap`. Self-hosted woff2 is emitted by the bundler; sizes are recorded in the pull request. Fallback stacks come from `tokens.json`.
- **Theme provider:** `ThemeProvider` exported from `@heat/ui`, a thin client component over `next-themes` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`). Both app root layouts mount it and set `suppressHydrationWarning` on `<html>`. The nonce wiring for the inline script belongs with the CSP ticket (#39) and is noted in `packages/ui/CLAUDE.md`. Storybook keeps its own decorator toggling the same `dark` class; the apps never use that decorator, so only one mechanism acts in each place.
- **Apps:** each app gets one `src/app/globals.css` with `@import "@heat/ui/styles.css"` and `@source "../../../../packages/ui/src"`, imported by its root layout, plus `@tailwindcss/postcss` and `postcss.config.mjs`. A test per app asserts exactly one CSS file exists in `src` and its content.
- **Tokens page:** `src/tokens/tokens.stories.tsx` renders every token with name and value as text (colour is never the only carrier), using a typed copy of the design export read at build time through Vite's JSON import of `docs/design/tokens.json`. Four stories (light, dark, per theme sections) with the axe check from #29.

Alternatives not chosen: generating `styles.css` from `tokens.json` in a build step (extra moving part, generated file under review anyway); `next/font` per app (owner chose `@fontsource-variable` from `@heat/ui`); keeping Tailwind default colours (they would dilute the palette and defeat the lint ticket).

## Files

| File                                                                                 | Change                                                                           |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `packages/ui/src/styles.css`                                                         | rewritten: Tailwind import, fonts, `@theme`, light and dark variables            |
| `packages/ui/src/placeholder/placeholder.tsx`                                        | classes instead of the `.heat-placeholder` CSS rules                             |
| `packages/ui/src/theme/theme-provider.tsx`, `src/index.ts`                           | new provider, exported                                                           |
| `packages/ui/src/tokens/tokens.stories.tsx`, `token-data.ts`                         | new Tokens page                                                                  |
| `packages/ui/test/support/css.ts`                                                    | new, brace-aware block reader                                                    |
| `packages/ui/test/tokens.test.ts`, `contrast.test.ts`, `utilities.test.ts`           | new                                                                              |
| `packages/ui/test/styles.test.ts`                                                    | replaced by the tests above                                                      |
| `packages/ui/test/theme/theme-provider.test.tsx`                                     | new, stored choice, device setting, no class on light                            |
| `packages/ui/.storybook/preview.css`, `preview.tsx`                                  | remove the Bengali font and locale leftovers, body styles from tokens            |
| `apps/*/src/app/globals.css`, `layout.tsx`, `postcss.config.mjs`, `package.json`    | one CSS entry, provider mounted, `@tailwindcss/postcss`                          |
| `apps/*/test/styles.test.ts`                                                         | new, one CSS entry, imports the theme and declares `@source`                     |
| `packages/ui/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`                  | `next-themes`, two font packages, `@tailwindcss/postcss`, `tailwindcss` catalog  |
| `packages/ui/CLAUDE.md`, `README.md`                                                 | English-only wording, token and theme notes                                      |

## Tasks

Each task is one commit: failing test first, see it fail for the right reason, least code, tick the box in the same commit.

- [x] **Task 1: colour, radius, spacing, type and shadow tokens match the export.** Tests first: `test/support/css.ts` and `test/tokens.test.ts` (every light and dark colour role, no role in one theme only, radius, spacing scale, 8 type styles with size, line height and weight, shadows per theme, chart colours, all with the same values as `tokens.json`; body text not under 16 px). Red: the four-variable stylesheet has none of it. Then write `styles.css` with `@theme`, `:root`, `.dark`.
- [x] **Task 2: contrast.** `test/contrast.test.ts` runs every `pairs` entry in both themes through `contrastRatio` and names the pair and ratio on failure; the focus ring is asserted against `background` and `card`. Red only if a value is wrong; if green at once, break one value to see the failure message, then restore.
- [x] **Task 3: Tailwind utilities resolve to the tokens.** `test/utilities.test.ts` with the `compile` API: `bg-primary`, `text-muted-foreground`, `bg-status-success`, `rounded-lg`, `shadow-md`, `font-display`, `dark:bg-card` resolve to token variables; `bg-red-500` yields nothing; every variable in `:root` is mapped in `@theme inline` (no unmapped variable). Then add `@import "tailwindcss"`, `@theme inline` and `@custom-variant dark`.
- [x] **Task 4: fonts.** Test: `styles.css` imports both font packages and the type tokens name Source Serif 4 Variable for headings and Public Sans Variable for body with the declared fallbacks; a build of the stylesheet with Vite (in the test) contains `@font-face` for both with `font-display: swap`, only Latin ranges, and no `http` font URL. Then install the two packages and add the imports and `--font-*` tokens.
- [x] **Task 5: theme provider.** `test/theme/theme-provider.test.tsx` (jsdom with a stubbed `matchMedia`): dark device setting and no stored choice gives `dark` on `<html>`; stored `light` wins over a dark device; light device leaves no class. Then `theme-provider.tsx`, export it, add `next-themes`.
- [x] **Task 6: app CSS entries and provider mounted.** `apps/*/test/styles.test.ts`: exactly one `.css` file in `src`, importing `@heat/ui/styles.css` and declaring `@source` for `packages/ui/src`; the root layout imports it and renders `ThemeProvider` with `suppressHydrationWarning` on `<html>`. Then add `globals.css`, `postcss.config.mjs`, `@tailwindcss/postcss`, edit both layouts. `pnpm build` of both apps passes and the shipped CSS contains only theme and Tailwind output.
- [ ] **Task 7: placeholder and Storybook cleanup, Tokens page.** Test: the placeholder renders with token utility classes and no `.heat-placeholder` selector remains in `styles.css`; `preview.css` has no Bengali font. Then the Tokens stories (colour roles, type styles, radius, spacing, shadows, chart colours, name and value as text) in light and dark, passing axe via `pnpm --filter @heat/ui test:stories`, plus a Latin specimen at serif 600 and 700 and sans 400, 600 and 700.
- [ ] **Task 8: docs.** `packages/ui/CLAUDE.md` loses "Bangla and English variants" and "full Bangla and Latin coverage" if still present; add the token rules (change `docs/design/tokens.json` and `styles.css` together, the test is the guard) and the CSP nonce note. README notes the Tokens page. The docs tests pass.

## Acceptance criteria to proof

| Criterion (refined)                                    | Proof                                                       |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| Tokens match the design export, no one-sided role      | Task 1 `tokens.test.ts`                                     |
| Dark class resolves every role to its dark value       | Task 1 (`.dark` block) and Task 3 (variant)                 |
| Theme follows device, stored choice wins, no flash     | Task 5, plus a real browser check at stage 6                |
| Contrast AA in both themes, focus ring 3:1             | Task 2                                                      |
| Fonts self-hosted, `swap`, sizes recorded              | Task 4, sizes in the pull request                           |
| Heading and body fonts, 16 px minimum                  | Task 1 and Task 7 specimen                                  |
| Apps ship only theme CSS plus Tailwind output          | Task 6 tests and build output inspection                    |
| Utilities resolve to tokens, no default palette        | Task 3                                                      |
| Tokens page complete and passes axe                    | Task 7 `test:stories`                                       |
| Placeholder story and tests still pass                 | Tasks 1 to 7 keep `test` and `test:stories` green           |

## Verification (stage 6)

`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build`, then `pnpm verify`; `pnpm --filter @heat/ui test:stories`; run both apps in a real browser at phone and laptop width in light and dark to check the class follows the device setting with no flash; record woff2 sizes and a check of heading layout shift against the LCP budget.
