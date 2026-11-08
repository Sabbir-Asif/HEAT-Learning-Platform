# Lint rules that keep styling inside `@heat/ui`: implementation plan

**Issue:** #34 (E1, size S, type chore). Branch `chore/34-lint-rules-that-keep`, based on `epic/e1-design-system-and-app-shells`. The `Refined` section of the issue, including the team lead decisions, is the spec.

## Goal

Lint, in the editor hook's reach and in CI, keeps styling inside `@heat/ui` (ADR 0013): apps cannot hold their own CSS, inline styles, arbitrary Tailwind values or non-layout utilities, and class conflicts and order are errors everywhere.

## Chosen approach

- **Two new presets in `@heat/config/eslint`**: `app` (for `apps/*`) and `ui` (for `packages/ui`). Each extends `react` and adds a `files`-scoped entry for `src/**`. ESLint resolves `files` globs against the directory of the config file that is loaded, so a single shared config cannot tell `apps/*/src` from `packages/ui/src`; each package selects its preset in its one-line `eslint.config.mjs`. The rules themselves live once, in `eslint/styling.js`.
- **Class rules from `eslint-plugin-better-tailwindcss` 4.10**: `no-conflicting-classes`, `enforce-consistent-class-order` (both set to `error`, order is auto-fixable) in apps and in `@heat/ui`; `no-restricted-classes` in apps only, with two patterns: any class containing `[` (arbitrary values and variants) and a negative-lookahead allow-list of layout utilities (display, flex, grid, gap, space, alignment, padding, margin, sizing, overflow, `container`) with breakpoint variants only. Messages name the class and point to `@heat/ui`. Non-literal expressions are ignored by the plugin.
- **`style` and `<style>`** are banned in app `src` with `no-restricted-syntax` selectors; imports of any stylesheet other than `globals.css` (including `.module.css`, `.scss`) are banned with an `ImportDeclaration` selector.
- **CSS files** are linted with `@eslint/css` (`language: "css/css"`, Tailwind at-rules tolerated) through one local rule on the `StyleSheet` node: a file under `apps/*/src` fails and the message names it, except `src/app/globals.css`, which may hold only `@import "@heat/ui/styles.css"` and `@source "..."`. `packages/ui` never gets the CSS entry.
- **Tailwind resolution**: the plugin switches itself off with a one-time warning when it cannot resolve `tailwindcss` from the lint directory, so `tailwindcss` (catalog, 4.3.5) is a dev dependency of both apps, `@heat/ui` and `@heat/config`. A test lints with each package's real `eslint.config.mjs` and `cwd`, and fails if the conflict rule does not fire.
- **No `eslint-disable` escape hatch** (the no-comments test forbids comments). The editor hook is not changed. Arbitrary values stay allowed in `@heat/ui`.

Alternatives not chosen: one shared config with `apps/*/src` globs (cannot match when loaded from a package directory); a Stylelint setup (a second linter for one rule); relying on review.

## Files

| File                                                                              | Change                                                      |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/config/eslint/styling.js`                                               | new, shared rule sets and the local CSS rule                |
| `packages/config/eslint/app.js`, `ui.js`                                          | new presets                                                 |
| `packages/config/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`           | exports, dependencies, `tailwindcss` in the catalog         |
| `apps/*/eslint.config.mjs`, `packages/ui/eslint.config.mjs`, their `package.json` | select the preset, add `tailwindcss`                        |
| `packages/config/test/styling.test.mjs`                                           | new, inline-string cases for every rule                     |
| `packages/config/test/styling-setup.test.mjs`                                     | new, `tailwindcss` resolvable and plugin active per package |
| `README.md`, `packages/ui/CLAUDE.md`                                              | Quality checks mention the rules                            |

## Tasks

Each task is one commit: failing test first, see it fail for the right reason, least code, tick the box in the same commit.

- [ ] **Task 1: Tailwind installed and resolvable.** Test first (`styling-setup.test.mjs`): `tailwindcss/package.json` resolves from `packages/config`, `packages/ui`, `apps/frontend-public` and `apps/frontend-internal`. Red: not installed. Then the catalog entry, dev dependencies, `eslint-plugin-better-tailwindcss` and `@eslint/css`, lockfile.
- [ ] **Task 2: conflicts and order are errors.** Tests: `p-2 p-4` and `flex grid` report `no-conflicting-classes`, `p-4 flex` reports `enforce-consistent-class-order` and `--fix` rewrites it, in the `app` and the `ui` preset; clean classes pass. Setup test: each package's real config reports the conflict (plugin is active). Then `styling.js`, `app.js`, `ui.js`, exports, one-line package configs.
- [ ] **Task 3: no arbitrary values in apps.** Tests: `mt-[13px]`, `md:w-[40%]`, `[&>*]:p-2`, `bg-[var(--x)]` fail in `className`, a template literal and `cn`, `clsx`, `cva` arguments; the same pass in the `ui` preset; `className={x}` does not crash.
- [ ] **Task 4: layout-only classes in apps.** Tests: allow-list classes with breakpoint variants pass; `bg-red-500`, `text-lg`, `rounded`, `dark:flex`, `hover:p-2` fail naming the class; the same pass in `ui`.
- [ ] **Task 5: no inline styles, style elements or extra stylesheets in apps.** Tests: `style={{...}}` on an element and a component, `<style>` and imports of `./x.module.css` and `./x.scss` fail; `import "./globals.css"` and the `ui` preset pass.
- [ ] **Task 6: one CSS entry in apps.** Tests: `src/components/extra.css` fails and the message names it; `src/app/globals.css` with only the allowed `@import` and `@source` passes; an extra rule or at-rule in it fails; Tailwind at-rules parse; CSS under `packages/ui` is not reported.
- [ ] **Task 7: docs and whole-repo check.** README Quality checks and `packages/ui/CLAUDE.md` mention the rules; `pnpm lint` over the real repo reports nothing.

## Acceptance criteria mapped to checks

| Criterion (refined)                                             | Check                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Extra `.css` in an app fails and names the file; entry passes   | Task 6 tests; demonstration in the verification log                       |
| `.module.css`, `.scss`, `<style>` banned in apps                | Task 5 tests                                                              |
| `style={...}` fails in apps, passes in `@heat/ui`               | Task 5 tests; demonstration                                               |
| Arbitrary values fail in apps (strings, templates, helpers)     | Task 3 tests; demonstration; same classes pass in `ui`                    |
| Conflicts and order are errors, order is fixable                | Task 2 tests; demonstration                                               |
| App classes outside the layout allow-list fail naming the class | Task 4 tests; demonstration                                               |
| Non-literal expressions neither reported nor crash              | Task 3 test                                                               |
| Unresolvable `tailwindcss` fails a test                         | Tasks 1 and 2 setup tests                                                 |
| Current sources have no violations; README updated; tests pass  | `pnpm lint`, `pnpm test:coverage` (includes the no-comments test); Task 7 |

## Verification

```sh
pnpm install --frozen-lockfile
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build
pnpm audit:deps
pnpm generate && git status --short
pnpm --filter @heat/ui build-storybook && pnpm --filter @heat/ui test:stories
pnpm verify
```

Each rule is demonstrated once by adding a violating file or line in an app (not committed), capturing the lint failure and removing it again. Results go to `verify-34.md`.
