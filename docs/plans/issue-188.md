# Plan for #188: DataTable, FilterBar and Pagination in `@heat/ui/data`

Goal: a table with server-side paging, sorting and filters kept in the URL, cards under `md`, a bottom-drawer filter bar and a pagination bar, behind the `@heat/ui/data` subpath so a page that does not use them does not load TanStack Table or nuqs.

Approach: the URL rules (allowed page sizes, parsing, clamping, sort cycle, range text) are pure functions in `src/data/url-state.ts`, unit tested. A `useTableUrlState` hook wraps them with nuqs. TanStack Table (manual sorting, no client row models) owns headers, rows and sort state. The table renders the rows it is given and reports changes, so the caller fetches. The nuqs provider belongs to the apps; stories use the nuqs testing adapter. Page size is in the URL (10, 25, 50, default 25).

## Tasks

- [x] 1. Test then code `src/data/url-state.ts`: `pageSizes`, `defaultPageSize`, `parsePageSize`, `parseSort`, `nextSort`, `pageCount`, `clampPage`, `rangeText`. Test in `test/data/url-state.test.ts`.
- [x] 2. Test then code the import-graph guard: `src/index.ts` never reaches `src/data`, `@tanstack/*` or `nuqs`; `primitives.test.ts` scans `data`, with `@tanstack/react-table` and `nuqs` allowed only there. Test in `test/data/subpath.test.ts`.
- [x] 3. Add `./data` to `exports`, the `table` primitive, and `useTableUrlState` (nuqs), with a story-level URL test later.
- [x] 4. `Pagination` with story (range text, icon-only controls, go-to-page validation, disabled ends, page size select).
- [x] 5. `FilterBar` with story (inline at `md`, bottom `Sheet` under `md`, Apply, Clear, Escape returns focus).
- [x] 6. `DataTable` with stories: sortable headers with `aria-sort`, cards under `md`, loading, empty, no matches, error with Retry, busy refetch, URL state through the nuqs testing adapter, invalid URL values.
- [x] 7. Docs in `packages/ui/CLAUDE.md`, final verify.

## Acceptance criteria to proof

| Criterion                                                        | Proof                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| URL updates on sort, filter, page and page size, reload restores | DataTable story with `onUrlUpdate`, `url-state.test.ts` |
| Invalid page, size, sort fall back                               | `url-state.test.ts`, story with a bad URL               |
| Sort cycle and `aria-sort`                                       | `url-state.test.ts`, story                              |
| Page resets on filter or size change, last page clamp            | `url-state.test.ts`, story                              |
| Cards under `md` with the same actions                           | story at phone width                                    |
| Filters in a bottom drawer under `md`                            | FilterBar story                                         |
| Loading, empty, no matches, error                                | DataTable stories                                       |
| Pagination range text, bounds, go to page                        | `url-state.test.ts`, Pagination story                   |
| axe light and dark, keyboard                                     | stories                                                 |
| `@heat/ui` root pulls in no TanStack Table or nuqs               | `subpath.test.ts`                                       |
| No horizontal scroll at 375 px                                   | phone story                                             |

## Verification

`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build`, `pnpm --filter @heat/ui test:stories`, then `pnpm verify`.
