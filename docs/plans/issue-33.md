# Plan for #33: feedback and display composites in `@heat/ui`

Part 6a of the split approved on 2026-11-09 (see the Refined section of #33). FormField, the data table and charts/upload are #187, #188 and #189.

## Goal

Add `PageHeader`, `StatusBadge`, `EmptyState`, `ErrorState`, `StatCard` and `ConfirmDialog` to `@heat/ui`, built from the #32 primitives and the #31 tokens only. No new runtime dependency.

## Approach

- Composites live in `packages/ui/src/composites/`, one file and one story file per component, exported from the root `index.ts`. They sit apart from `components/` (shadcn-generated primitives) so the two kinds stay distinguishable.
- Status logic is plain data in `src/composites/status.ts`: a `Record` over the contract-style state names mapping to `{ label, icon, tone }`, with an exhaustive type so a missing state fails typecheck. The tones come from `docs/design/tokens.json` `statusTones`. A unit test reads that file and asserts the mapping equals it. This is the one place that logic is unit tested in jsdom; rendering is covered by stories in a real browser, as for primitives.
- `StatusBadge` extends `Badge` with a tone class set using the existing `status-*` colour tokens (background, foreground, mark for the icon). It always shows an icon and a label. Unknown values render a neutral badge with the raw value.
- `ConfirmDialog` is a controlled `Sheet`: `side` is `right` at laptop width and `bottom` under `md` (via `useIsMobile`). Props: `open`, `onOpenChange`, `title`, `itemName`, `description`, `confirmLabel`, `onConfirm` (async), `confirmationName` (optional; enables the typed-name level). Typed-name compare is NFC plus trim, case-sensitive; skipped when the name is empty or longer than 80 characters. The pending state disables a second press and a failure shows an inline error with the drawer left open.
- `PageHeader`: title, optional breadcrumbs slot, one primary action. The action is a `Button` with an icon and a label; the label hides under the tablet width with a tooltip and an accessible name.
- `EmptyState` / `ErrorState`: small icon, title, one line, optional action; `ErrorState` has Retry calling `onRetry`. No hero artwork.
- `StatCard`: value, label, optional trend with a visually hidden text for direction. Built on `Card`.
- Rejected: `AlertDialog` (design says drawers over modals), and putting the mapping in `@heat/contracts` (it holds API shapes, not presentation).

## Files

- Create: `packages/ui/src/composites/{status.ts,status-badge.tsx,page-header.tsx,empty-state.tsx,error-state.tsx,stat-card.tsx,confirm-dialog.tsx}` and a `*.stories.tsx` for each component.
- Create: `packages/ui/test/status.test.ts`, `packages/ui/test/confirmation.test.ts` (the typed-name matcher, a pure function in `src/composites/confirmation.ts`).
- Change: `packages/ui/src/index.ts`, `packages/ui/test/index.test.ts`, `packages/ui/test/primitives.test.ts` (scan `composites`), `packages/ui/vitest.config.mjs` (coverage exclude for `src/composites/**/*.tsx`), `packages/ui/CLAUDE.md`.

## Tasks

Each task is test first, then the code, then a commit `feat(ui): ... (#33)`.

- [x] 1. Guard test scans `composites/`. Failing: add the directory to `scanned`; with a stub file containing a colour literal the test fails, then remove the stub. Commit.
- [x] 2. `status.ts`. Failing test `status.test.ts`: every key of `tokens.json` `statusTones` has an entry with the same tone, a non-empty label and an icon; contract enum names (`PENDING_VERIFICATION` and so on) resolve to the same entries; an unknown value resolves to neutral with the raw value. Then the mapping and `resolveStatus`. Commit.
- [x] 3. `StatusBadge` and its story (every state, light, dark; axe in both). Commit.
- [x] 4. `confirmation.ts`. Failing test: exact match after trim and NFC passes, a different case fails, empty or over-long names disable the typed field. Commit.
- [x] 5. `ConfirmDialog` and its story with `play` tests: open, focus moves in, Tab cycles inside, Escape closes and returns focus, Confirm disabled until the name matches and re-disabled on edit, pending blocks a second press, a failure shows the inline error and the drawer stays open, bottom side under `md`. Commit.
- [x] 6. `EmptyState`, `ErrorState` (Retry calls `onRetry`) and stories. Commit.
- [x] 7. `PageHeader` and story (phone width: title wraps, label hides, accessible name and tooltip). Commit.
- [x] 8. `StatCard` and story. Commit.
- [x] 9. Exports, `index.test.ts`, coverage config, `packages/ui/CLAUDE.md` (composites folder, status mapping, ConfirmDialog levels). Commit.

## Acceptance criteria to proof

| Criterion | Proof |
| --- | --- |
| ConfirmDialog drawer, typed name, reversible, pending and failure, keyboard | task 5 story `play` tests, task 4 unit test |
| StatusBadge covers every state, unknown value | task 2 unit test, task 3 story |
| Empty, error, loading placeholders match the frames | task 6 stories, checked against `admin-approvals-*` frames in the browser |
| PageHeader at phone width | task 7 story at a phone viewport |
| StatCard trend text alternative | task 8 story |
| Axe in light and dark | `test:stories` on every story |
| Token-only source, no comments | `primitives.test.ts` scanning `composites/` |
| No new heavy dependency in the root bundle | no dependency added; `frontend-public` build unchanged |

Criteria for FormField, DataTable, Pagination, ChartCard, FileUpload and the subpath bundle checks belong to #187, #188 and #189.

## Verification

```sh
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build
pnpm --filter @heat/ui test:stories
pnpm --filter @heat/config test
pnpm verify
```

Then open the stories in a browser at phone (360 px) and laptop (1280 px) width in light and dark, and compare with the design frames.
