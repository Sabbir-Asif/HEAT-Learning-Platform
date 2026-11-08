# Issue 181: Remove Bangla and all multi-language support

## Goal

The HEAT LMS has one language, English. Remove Bangla, `next-intl`, `[locale]` routing and `@heat/i18n` from code, docs, ADRs and workflow files.

## Approach

Delete the `@heat/i18n` package and every reference to it, drop the Bengali font and locale toolbar from Storybook, then edit the docs and workflow files in place. A repository search for the removed terms is the check that nothing was missed. ADR 0009 stays as history and is marked Superseded by a short English-only ADR that the owner reviews.

## Tasks

- [x] 1. Search check first. Add a test in `packages/config/test` that runs `git grep` for `bangla|bengali|next-intl|[locale]|@heat/i18n|noto-sans-bengali` over tracked files and fails on matches outside the ADR files. See it fail, then pass at the end of tasks 2 to 6. Commit.
- [x] 2. Remove `packages/i18n`, the `@heat/i18n` dependency and `transpilePackages` entry in both apps, and regenerate `pnpm-lock.yaml` with `pnpm install`. Both apps still build and serve `/`. Commit.
- [x] 3. `@heat/ui`: remove `@fontsource-variable/noto-sans-bengali`, the Bengali rule in `preview.css`, the `locale` global and `lang` switch in `preview.tsx`, and the Bangla stories and font check in `placeholder.stories.tsx`. Set `lang="en"`. `pnpm --filter @heat/ui test:stories` passes. Commit.
- [x] 4. Tests: rename the Bangla title in `injector.test.mjs` and keep a non-ASCII fixture; fix `ticket.test.mjs` if it names Bangla. Commit.
- [x] 5. Docs: root `CLAUDE.md`, area `CLAUDE.md` files, `README.md`, the frontend architecture spec, the project plan, `lms_production_implementation_plan.md` and the plans in `docs/plans`. Commit.
- [x] 6. Workflow files: `.claude/agents/refiner.md`, `.claude/skills/implement-issue/` and `.github/pull_request_template.md`. Commit.
- [x] 7. ADRs: add the English-only ADR, mark ADR 0009 Superseded, update the index, and list ADR 0008's mention for the owner. Commit.
- [x] 8. Comment on #181 listing the other tickets that mention Bangla (#36, #96, #119, #153 and others from a search), for the owner to approve. Do not edit them.

## Acceptance criteria and proof

| Criterion | Proof |
| --- | --- |
| No mention of the removed terms outside ADR history | Task 1 test and `git grep` |
| Lockfile clean, install frozen | `pnpm install --frozen-lockfile` |
| Apps serve `/` with `lang="en"`, `/en/` and `/bn/` give 404 | `pnpm build`, then start both apps and request the paths |
| Storybook passes axe, theme control only | `pnpm --filter @heat/ui test:stories` |
| Repository checks pass | `pnpm verify` |
| ADR proposal and ticket list | The pull request and the issue comment |

## Verification

`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build`, then `pnpm verify`.
