# Plan for #189: ChartCard and FileUpload

Goal: `ChartCard` in `@heat/ui/charts` (Recharts 3, CSV download of the data shown) and `FileUpload` in `@heat/ui/upload` (Uppy core as the headless file store), each behind its own subpath so a page loads only what it uses.

Approach: the rules are pure functions with unit tests: `csv.ts` (cell neutralisation, RFC 4180 quoting, BOM, safe file name, Dhaka dates) and `limits.ts` (type, size, count, duplicate, name checks and presets). The components are thin. `FileUpload` follows the owner's decision of 2026-11-09: it picks files, checks them in the browser (convenience only, the server is the real gate) and hands accepted files to the screen; the screen uploads through `@heat/api-client` and reports status and progress back through props. `@uppy/core` holds the selection, with `onBeforeFileAdded` calling our rules.

## Tasks

- [x] 1. Test then code `src/charts/csv.ts`. Test in `test/charts/csv.test.ts`.
- [x] 2. Test then code `src/upload/limits.ts`. Test in `test/upload/limits.test.ts`.
- [x] 3. Extend the guard tests: `charts` and `upload` scanned, `recharts` only in `charts`, `@uppy/*` only in `upload`; bundle check for the root, `/charts` and `/upload`; add `./charts` and `./upload` to `exports`. Test in `test/data/subpath.test.ts` and `primitives.test.ts`.
- [x] 4. `ChartCard` with stories: default, loading, empty, error, several series, CSV download content, phone width, light and dark.
- [ ] 5. `FileUpload` with stories: idle, accepted, uploading, failed with Retry, limit rejected, keyboard, light and dark.
- [ ] 6. Docs in `packages/ui/CLAUDE.md`, gzip sizes of `/charts` and `/upload` for the PR, final verify.

## Acceptance criteria to proof

| Criterion | Proof |
| --- | --- |
| CSV has exactly the rows shown, same columns and labels | `csv.test.ts`, ChartCard story |
| Formula characters neutralised, quoting, negatives kept | `csv.test.ts` |
| Dhaka dates in CSV | `csv.test.ts` |
| Empty, loading, error states | ChartCard stories |
| Series limited to five, colours from `--chart-N` | type, guard test, story |
| Text alternative and data table | ChartCard story |
| No horizontal scroll at 320 px | phone story |
| Type, size, count, duplicate, name rules | `limits.test.ts` |
| Rejection names the limit, keyboard use, status announced | FileUpload stories |
| Server rendering safe, Uppy destroyed on unmount | FileUpload story, code |
| Root, `/charts` and `/upload` stay separate | `subpath.test.ts` |
| axe light and dark | stories |

## Verification

`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build`, `pnpm --filter @heat/ui test:stories`, then `pnpm verify`.
