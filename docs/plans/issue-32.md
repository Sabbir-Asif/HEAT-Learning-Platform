# shadcn base components on Base UI themed by tokens in `@heat/ui`: implementation plan

**Issue:** #32 (E1, size M, type feature). Branch `feat/32-shadcn-base-components-base`, based on `epic/e1-design-system-and-app-shells`. The `## Refined` section of the issue is the spec.

## Goal

`@heat/ui` exports the shadcn primitives on Base UI that the approved designs need, themed only by the tokens from #31, each with light, dark and default stories that pass axe, and keyboard behaviour covered by Storybook interaction tests.

## Chosen approach

- **shadcn CLI 4.x in monorepo mode** with `packages/ui/components.json` (style `base-nova`, aliases inside `packages/ui`, `css` pointing at the existing `src/styles.css`). Generated files are the starting point, then cleaned: comments removed, Prettier applied, hard-coded colours replaced by tokens. Chosen over hand-writing every primitive because it keeps the code upgradeable with `shadcn diff`, and over copying from another project because the CLI knows the Base UI variant.
- **Two groups, two commits series**, as the refinement suggests if size grows: (a) setup, `cn`, form and display primitives; (b) overlays, navigation and Sonner.
- **Enforcement by test:** `test/primitives.test.ts` reads every file in `src/components` and fails on a hex, rgb, hsl or Tailwind default-palette colour, on an arbitrary value holding a colour, size, radius or font, and on any comment. Base UI state selectors (`data-[...]`, `in-data-[...]`, popup size variables) are allowed.
- **Bundle check:** a test reads `package.json` dependencies and the source imports and fails when a UI library outside Base UI, Lucide, Sonner, `class-variance-authority`, `clsx` and `tailwind-merge` is imported.
- **Stories:** one file per primitive with `Default` (follows the toolbar), `Light` and `Dark` pinned by `globals`; form controls add focus, disabled and invalid; Dialog, Sheet, DropdownMenu, Select and Tabs add `play` keyboard tests.
- **Root export:** `src/index.ts` re-exports every primitive and its prop types. Components that use state or Base UI start with `"use client"`.
- **Working defaults** from the refinement apply: Base UI state selectors allowed; no Sidebar cookie; `Dialog` is built next to `Sheet`.

Not chosen: Radix-based shadcn (ADR 0013 names Base UI); one barrel per primitive subpath (premature; heavy pieces are separate tickets).

## Files

| File                                                                | Change                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/ui/components.json`                                       | new, shadcn config                                                     |
| `packages/ui/src/lib/utils.ts`                                      | new, `cn`                                                              |
| `packages/ui/src/components/*.tsx`                                  | new, one file per primitive                                            |
| `packages/ui/src/components/*.stories.tsx`                          | new, stories (placed beside each primitive)                            |
| `packages/ui/src/hooks/use-mobile.ts`                               | new, used by Sidebar                                                   |
| `packages/ui/src/index.ts`                                          | export the primitives                                                  |
| `packages/ui/src/placeholder/`                                      | removed, with its test                                                 |
| `packages/ui/test/primitives.test.ts`                               | new, token-only, no-comment and allowed-library checks                 |
| `packages/ui/package.json`, `pnpm-lock.yaml` | new runtime dependencies, pinned exactly like the existing ones                              |
| `packages/ui/CLAUDE.md`, `CLAUDE.md` (root)                         | reference row only if a pattern lands first; note on adding primitives |

## Tasks

Each task is one commit: failing test first, see it fail for the right reason, least code, tick the box in the same commit.

- [x] **Task 1: setup and `cn`.** Test first: `test/utils.test.ts` (`cn` merges and de-duplicates conflicting Tailwind classes) and `test/primitives.test.ts` (rules above, passing on an empty folder, then failing on a fixture with a hex colour). Red: modules missing. Then dependencies, `components.json`, `src/lib/utils.ts`.
- [x] **Task 2: Button, Badge, Separator, Skeleton, Progress, Card.** Stories first with axe; red: components missing. Generate, clean, export. Button label-hiding below tablet width with Tooltip is covered in Task 5.
- [x] **Task 3: Label, Field, Input, Textarea, Checkbox, RadioGroup.** Stories for default, focus, disabled, invalid (`aria-invalid`, error text linked with `aria-describedby`).
- [x] **Task 4: Select, Combobox.** Stories with long English strings and the empty-results state; keyboard `play` tests for Select.
- [x] **Task 5: Tooltip, Tabs, Breadcrumb, DropdownMenu.** Keyboard `play` tests for Tabs and DropdownMenu; Tooltip reachable by focus; icon-only Button keeps its accessible name.
- [x] **Task 6: Dialog, Sheet.** `play` tests: focus moves in, is trapped, Escape closes, focus returns to the trigger; 360 px viewport story.
- [x] **Task 7: Sidebar and Sonner.** Sidebar collapses into a Sheet on phones, no cookie; Sonner toaster story with live region.
- [x] **Task 8: export, placeholder removal, docs.** Test: `test/index.test.ts` lists every primitive export. Remove `src/placeholder` and its test. Update `packages/ui/CLAUDE.md`.

## Acceptance criteria mapped to checks

| Criterion (refined)                              | Check                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| shadcn CLI writes into `packages/ui` with tokens | `components.json` committed; `pnpm dlx shadcn add` dry run                             |
| Light, dark, default story, axe clean            | `pnpm --filter @heat/ui test:stories`                                                  |
| Keyboard behaviour of five overlays/controls     | `play` tests in Dialog, Sheet, DropdownMenu, Tabs, Select stories                      |
| Token-only source, no comments                   | `test/primitives.test.ts`                                                              |
| No other UI library bundled                      | `test/primitives.test.ts` import check; `pnpm build` of both apps                      |
| Root export resolves                             | `test/index.test.ts`; app `pnpm typecheck` importing `Button`                          |
| Form control states                              | stories for default, focus, disabled, invalid                                          |
| Phone width containment                          | 360 px stories checked in the browser                                                  |
| Lint, format, typecheck, coverage pass           | `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build` |

## Verification

`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build`, then `pnpm --filter @heat/ui test:stories`, then `pnpm verify`. Open Storybook in a real browser at phone and laptop width, light and dark, and save screenshots in the scratch directory.
