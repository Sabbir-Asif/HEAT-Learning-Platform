# README `config/` layout entry plan

**Goal:** The package layout in `README.md` describes `packages/config` fully: the tsconfig, ESLint, Prettier and Vitest presets and the repository scripts.

**Approach:** Give `config/` its own full-width row under the two-column grid, so the fuller description fits without re-flowing other entries. Rejected: widening the right-hand column, which pushes every row past a readable width and touches every line of the block.

**Files:** `README.md` (layout block only).

**Spec:** issue #168 with its Refined section. Owner decision: no new test for this docs-only change.

## Acceptance criteria → proof

| Criterion | Proof |
| --- | --- |
| `config/` names the four presets and covers all three bin scripts, `ticket` included | the diff; the rendered block in the pull request |
| Does not suggest `dev:*` scripts live in config | the diff names only `audit:deps`, `github:setup`, `ticket` |
| `pnpm format:check` and `pnpm --filter @heat/config test` pass | stage 6 log |
| Only the `config/` entry changes | `git diff --stat` shows one file; the diff shows the i18n row losing its second column and one new row |

## Tasks

- [ ] **Task 1: Rewrite the `config/` entry.** Remove `config/   tsconfig presets` from the `i18n/` row and add the row `  config/     tsconfig, ESLint, Prettier and Vitest presets; repository scripts (audit:deps, github:setup, ticket)`. Commit `docs: describe everything packages/config holds in the README layout (#168)`.

## Verification

```sh
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build
pnpm --filter @heat/config test
git diff --stat origin/epic/e0-engineering-foundation...HEAD -- README.md
```
