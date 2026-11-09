# Issue 38: accessibility and visual regression baseline

Approach: one workspace package, `@heat/e2e` (`packages/e2e`), holds the Playwright config and both suites for the two apps. Tests read the route manifests from #37, so a new route is covered without editing the suite. Both suites run against `next build` plus `next start`.

Decisions

- Playwright 1.65.0 and `@axe-core/playwright` are pinned once in the pnpm catalog; `@heat/ui` moves to the catalog entry.
- Playwright files end in `.e2e.ts` so the Vitest preset and the layout rule that polices `.test` and `.spec` files stay untouched. The scripts are named `e2e*`, never `test`, so Turborepo does not run them.
- Accessibility suite: every manifest route, 390 and 1440 px wide, light and dark through the emulated colour scheme, WCAG 2.0, 2.1 and 2.2 A and AA tags. The theme switch is exercised once per app, the open admin sheet is scanned, and a focus-visible check covers the first tab stops of each layout.
- Screenshot suite: representative pages only, named `{app}-{page}-{width}-{theme}`, animations disabled, fonts awaited, `dark` class asserted before capture. Baselines live in `packages/e2e/test/__screenshots__`.
- CI: `accessibility` is a required check; `screenshots` is not, never fails the run, writes a `::warning` and a job summary, and uploads actual, expected and diff images for 7 days. Both run in the pinned Playwright image (tag and digest), as does the README command that regenerates baselines.

Steps

1. Package scaffold, catalog pin, config. Failing first: the accessibility suite does not exist.
2. Accessibility suite, then a deliberate violation run to see the failure output.
3. Screenshot suite and baselines generated in the pinned image.
4. CI jobs, branch protection, workflow tests.
5. README.
