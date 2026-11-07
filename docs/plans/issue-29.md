# Storybook for `@heat/ui` with accessibility checks: implementation plan

**Issue:** #29 (E0, size S, type chore). Branch `chore/29-storybook-heat-ui-accessibility`, based on `epic/e0-engineering-foundation`. The refined acceptance criteria in the issue are the spec.

## Goal

Every `@heat/ui` component gets a story in light and dark, Bangla and English, and a failed axe check fails CI. This ticket delivers the workbench and one placeholder component that proves it. Tokens (E1-2) and real components (E1-3, E1-4) stay out of scope.

## Chosen approach

- **Storybook 10.6.6 with `@storybook/react-vite`**, `@storybook/addon-a11y` (axe, `test: 'error'`) and `@storybook/addon-vitest`. Compatibility with the catalog Vitest 5.1.0 is checked: the addon peers `vitest ^4.0.0 || ^5.0.0` and `@vitest/browser-playwright ^4 || ^5`, and `@vitest/browser-playwright@5.1.0` exists and peers `vitest 5.1.0`. No other Vitest is pinned.
- **Story tests are a second Vitest config** (`packages/ui/vitest.stories.config.mjs`, script `test:stories`) rather than a `projects` entry in `vitest.config.mjs`. The existing `test` and `test:coverage` stay jsdom-only, so the 85% gate, the root `pnpm test` and `pnpm test:coverage` do not start a browser and stories never enter the coverage numbers. Story tests run only in `test:stories` and the new CI job.
- **Theme and locale** are toolbar `globalTypes` in `.storybook/preview.tsx`, applied by one decorator. Dark is the `.dark` class (shadcn and next-themes default; E1-2 must use the same). The decorator sets the class and `lang` on the story root and on `document.documentElement`, so portalled content follows. `dir` stays `ltr`. Hand-written decorator instead of `@storybook/addon-themes`: one fewer dependency for ten lines.
- **The four combinations** are four stories with `globals: { theme, locale }` (`LightEnglish`, `LightBangla`, `DarkEnglish`, `DarkBangla`). Each is a test, and each gets the automatic axe check, so `color-contrast` in dark is covered. Sample strings are story-local fixtures; `@heat/ui` takes no i18n dependency.
- **Bangla font:** temporary self-hosted `@fontsource-variable/noto-sans-bengali` (Bengali and Latin subsets, woff2 files bundled by Vite), imported from the story preview CSS `.storybook/preview.css`. No CDN, no `next/font`. Replaced when E1-2 and the Open Pencil font choice land.
- **Placeholder tokens:** a minimal throwaway `src/styles.css` with a few CSS variables for light and `.dark`; no Tailwind. E1-2 replaces it. The placeholder component `Placeholder` (heading, text, one button) is not exported from the package index and is deleted when E1-3 lands the first real component.
- **CI:** a new `storybook` job in `ci.yml`, no path filter, that installs Chromium (Playwright browser cache), builds static Storybook, runs the story tests and uploads `storybook-static` with an SHA-pinned `actions/upload-artifact` (7 days, also when tests fail). It is not a required check until the owner adds it to `.github/branch-protection.json` and re-applies it (owner-only; not edited here).
- **Gate proof:** one deliberately inaccessible story (`<button>` with only an icon, no name) is added, the failing run is captured with its axe rule id (`button-name`) in the verification log, then the story is removed.

Alternatives not chosen: Vitest `projects` in the existing config (a browser would start for every `pnpm test`, and coverage config gets entangled); `@storybook/test-runner` (separate Jest runner, duplicates the Vitest setup the repo already has); `addon-themes` (a dependency for a class toggle).

## Files

| File                                                  | Change                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/ui/src/placeholder/placeholder.tsx`         | new, placeholder component                                                                           |
| `packages/ui/src/placeholder/placeholder.stories.tsx` | new, four theme/locale stories with `play` assertions                                                |
| `packages/ui/src/styles.css`                          | new, throwaway tokens for light and `.dark`                                                          |
| `packages/ui/test/placeholder/placeholder.test.tsx`   | new, jsdom unit test (keeps the 85% gate honest)                                                     |
| `packages/ui/test/styles.test.ts`                     | new, both token sets define the same variables                                                       |
| `packages/ui/.storybook/main.ts`, `preview.tsx`, `preview.css` | new, Storybook config, globals and decorator, font                                          |
| `packages/ui/vitest.stories.config.mjs`               | new, Storybook Vitest plugin with Playwright Chromium                                                |
| `packages/ui/vitest.config.mjs`                       | stories and `.storybook` excluded from coverage                                                      |
| `packages/ui/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` | dev dependencies and scripts (`storybook`, `build-storybook`, `test:stories`); catalog entries |
| `packages/ui/tsconfig.json`                           | include `.storybook`                                                                                 |
| `.gitignore`, `packages/config/eslint/base.js`        | ignore `storybook-static`                                                                            |
| `.github/workflows/ci.yml`                            | new `storybook` job                                                                                  |
| `packages/config/test/workflows.test.mjs`             | tests for the Storybook job                                                                          |
| `README.md`, `packages/ui/CLAUDE.md`                  | Storybook section and running note                                                                   |

## Tasks

Each task is one commit: failing test first, see it fail for the right reason, least code, tick the box in the same commit.

- [x] **Task 1: placeholder component and tokens.** Tests first: `test/placeholder/placeholder.test.tsx` (renders heading, text and a named button from props) and `test/styles.test.ts` (`:root` and `.dark` define the same custom properties, including colours for background, foreground, primary and primary-foreground). Red: modules missing. Then `placeholder.tsx` and `styles.css`; add `react-dom` as a dev dependency for `renderToStaticMarkup`.
- [ ] **Task 2: Storybook and story-test harness.** Add the dev dependencies, `.storybook/main.ts`, minimal `preview.tsx`, `vitest.stories.config.mjs`, scripts, `tsconfig` include and a coverage exclusion. First story `LightEnglish` with `a11y: { test: 'error' }`. Red: `pnpm --filter @heat/ui test:stories` fails before the config exists (no Storybook config), green once it renders and passes axe in Chromium.
- [ ] **Task 3: theme global.** Story `DarkEnglish` (`globals: { theme: "dark" }`) with a `play` that expects `.dark` on the story root and on `document.documentElement` and the heading's computed colour to equal the dark token, and `LightEnglish` to be different. Red: no theme decorator. Then the `theme` `globalType` and decorator and `preview.css` base colours.
- [ ] **Task 4: locale global and Bangla font.** Stories `LightBangla` and `DarkBangla` with a `play` that expects `lang="bn"`, waits for `document.fonts.ready`, and expects the Noto Sans Bengali face to be loaded and applied (`document.fonts.check` and computed `font-family`). Red: no locale decorator or font. Then the `locale` `globalType`, `lang` handling and the self-hosted font import.
- [ ] **Task 5: all four combinations pass axe.** Stories `DarkEnglish` and `DarkBangla` included in the run with the a11y gate on by default from `preview.tsx` (`parameters.a11y.test = "error"`). Red check: before the default is set a story without the local parameter does not fail the gate (shown by the proof in Task 6). Then confirm zero violations, `color-contrast` included, in all four.
- [ ] **Task 6: prove the gate fails with a rule id.** Add `InaccessibleButton` (icon-only button, no name). Run `test:stories`, capture the failure naming `button-name` into the verification log. Commit the story, then remove it in a second commit.
- [ ] **Task 7: CI job.** Tests first in `workflows.test.mjs`: a job named `storybook` exists, has no path filter, runs `test:stories` and `build-storybook`, uploads `storybook-static` with `retention-days: 7`, uses `if: ${{ !cancelled() }}` on the upload, and has a `timeout-minutes`. Red: no such job. Then the job, with Playwright browsers cached.
- [ ] **Task 8: ignore files and docs.** Red: after `build-storybook` the output shows in `git status` and `pnpm lint`. Then ignore `storybook-static` in `.gitignore` (Prettier reads it) and ESLint base. README "Storybook" section (commands, the one-time `playwright install`, story tests, the artifact) and a note in `packages/ui/CLAUDE.md`.

## Acceptance criteria mapped to checks

| Criterion (refined)                                                                   | Check                                                                                                    |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Stories listed; toolbar has theme (light, dark) and locale (bn, en)                   | Real-browser check of `pnpm --filter @heat/ui storybook` with screenshots; `globalTypes` in `preview.tsx` |
| Theme switched to dark: dark selector on story root and `documentElement`, colours change | Task 3 `play` assertions (story test); browser check                                                  |
| Locale bn: `lang="bn"`, Bangla text in the configured self-hosted font                | Task 4 `play` assertions after `document.fonts.ready`; browser check                                     |
| Four combinations pass axe, `color-contrast` in dark included                         | Task 5, `test:stories` with `a11y.test = "error"`                                                        |
| Missing accessible name fails with the axe rule id                                    | Task 6 captured failing output (`button-name`) in the verification log                                   |
| CI runs story tests and builds static Storybook, uploaded as `storybook-static`       | Task 7 workflow tests; first CI run on the pull request                                                  |
| Storybook job always runs (no path filter)                                            | Task 7 workflow test                                                                                     |
| Root commands pass; stories do not dilute coverage; `storybook-static` ignored        | `pnpm lint`, `format:check`, `typecheck`, `test:coverage`, `build`; Task 8                               |
| Frozen lockfile; Storybook, Playwright and axe only dev dependencies of `@heat/ui`    | `pnpm install --frozen-lockfile`; diff of `package.json` files                                           |
| `pnpm audit:deps` has no new high or critical advisory                                | `pnpm audit:deps`                                                                                        |

## Verification

```sh
pnpm install --frozen-lockfile
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build
pnpm --filter @heat/ui exec playwright install chromium   # one time
pnpm --filter @heat/ui test:stories
pnpm --filter @heat/ui build-storybook
pnpm audit:deps
```

Then the Storybook UI is opened in a real browser, theme and locale are switched in the toolbar, and screenshots are kept in the verification log. Results go to `verify-29.md`.

## Risks and edge cases

- pnpm 11 build-script approvals and `minimumReleaseAge` may need entries for new packages (for example `esbuild`); add the smallest entry and say so in the pull request.
- Playwright Chromium in CI is cached by Playwright version and the job has a timeout.
- If Storybook and Vitest 5.1.0 turn out incompatible in practice, stop and ask the owner; no other Vitest is pinned.
- The static build holds no secrets or environment values.
