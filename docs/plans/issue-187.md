# Plan for #187: FormField with React Hook Form

Goal: a `FormField`, a `Form` wrapper, a `FormMessage` and a helper that applies a server error response to a React Hook Form form, all in `@heat/ui`. This fills the Form row of the reference implementations table.

Approach: the mapping logic is a pure module (`form-errors.ts`) tested in jsdom. The components are thin and tested through stories with axe. `@heat/ui` does not depend on `@heat/contracts`: the helper takes a structural `{ error: { code, fields? } }` shape. Server errors are applied with `setError`, the form-level message is `errors.root.server`, and focus goes to the first invalid `FormField` in DOM order.

## Tasks

- [x] 1. Test then code `form-errors.ts`: copy for every field code, form-level copy per error code, `toFormErrors(payload, knownPaths)` that splits matched fields from the form-level message, and a generic fallback for a payload that is not an error response. Test in `test/form-errors.test.ts`.
- [x] 2. Test then code `applyServerError(form, payload, options)`: sets field errors and `root.server`, leaf paths of `getValues()` are the known fields, focus goes to the first invalid field in DOM order. Test with a fake form in `test/apply-server-error.test.ts`.
- [ ] 3. `Form`, `FormField`, `FormMessage` in `src/composites/form.tsx` with the ARIA wiring, and stories (Default, Light, Dark, ServerError with Input, Textarea and Select, FormLevel).
- [ ] 4. Export from `src/index.ts`, extend `index.test.ts`, allow `react-hook-form` in `primitives.test.ts`, document in `packages/ui/CLAUDE.md` and the root `CLAUDE.md` Form row.

## Acceptance criteria to proof

| Criterion | Proof |
| --- | --- |
| Label, control, description, error, ARIA wiring | story play functions, axe |
| Server errors mapped to fields, nested paths | `form-errors.test.ts`, ServerError story |
| First invalid field in DOM order gets focus | `apply-server-error.test.ts`, ServerError story |
| Unmatched path or no fields gives one form-level message | `form-errors.test.ts`, FormLevel story |
| Invalid payload gives a generic message | `form-errors.test.ts` |
| Editing a field clears only its error; a pending submit ignores a second press | story play functions |
| Copy for every field code | `form-errors.test.ts`, exhaustive record type |

## Verification

`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build`, `pnpm --filter @heat/ui test:stories`, then `pnpm verify`.
