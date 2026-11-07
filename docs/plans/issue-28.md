# OpenAPI spec from NestJS and orval client generation plan

**Goal:** The API emits an OpenAPI document at build time with no database or server. Orval 8 turns it into TanStack Query hooks, Zod schemas and MSW mocks in `@heat/api-client`, with a fetch mutator, a server-only fetcher and a CI job that fails when the committed client is out of date.

**Spec:** issue #28 with its Refined section and the team lead defaults (envelope shape, `API_INTERNAL_URL`, committed `openapi.json` and generated client, drift job not required). ADR 0001 and 0015, frontend design 5 and 12.

## Compatibility spike (done before this plan)

`@nestjs/swagger` 12.1.1, `nestjs-zod` 5.5.0, `orval` 8.46.0 and Zod 4.6.7 install under pnpm's release-age rule and work together on Nest 12.4.0: a nestjs-zod DTO produced a correct OpenAPI document through `SwaggerModule.createDocument` + `cleanupOpenApiDoc`, `ZodValidationPipe` rejected bad bodies and queries under both `tsc` output and Vitest, and orval generated hooks, MSW handlers and Zod schemas from that document. Findings to carry:

- `nestjs-zod@5.5.0` declares peers `@nestjs/common ^10 || ^11` and `@nestjs/swagger ^7.4.2 || ^8 || ^11`, so `pnpm peers check` reports two unmet peers (Nest 12, swagger 12). It works at runtime; the owner may want to track this.
- `@tanstack/react-query@5.107.1` was inside the release-age window, so `5.106.1` is pinned instead of adding an exclusion.
- `@scarf/scarf` (swagger-ui-dist) has an install script; `pnpm install --frozen-lockfile` exits 1 until it is listed in `allowBuilds` as `false`.

## Approach and why

- **Spec by preview app, not a running server.** `NestFactory.create(AppModule, { preview: true })` builds the module graph without instantiating providers, so a later database provider cannot break the emit. `configureApp()` is called so the `api` prefix is in every path. Rejected: booting the full app (needs Postgres and Redis later) and the Nest CLI swagger plugin (adds a compile step and hides the DTO source).
- **DTOs from contracts.** `createZodDto(healthResponseSchema)`; `@ApiOkResponse({ type })` puts the response in the spec. Operation ids come from an `operationIdFactory` (`healthCheck`) so hook names are stable and readable (`useHealthCheck`).
- **Deterministic output.** The emitter sorts object keys recursively, writes two-space JSON plus a newline, and puts no timestamp, path or environment value in the document. `apps/api/openapi.json` is committed and ignored by Prettier, like `src/generated`.
- **Error envelope.** `@heat/contracts` gets a closed `errorCodes` list, `clientErrorCodes` for failures that never reach the API (network, abort, unreadable response) and `errorResponseSchema`. A global `ApiExceptionFilter` maps Zod validation errors, `HttpException` and unknown errors to it, with fixed messages (never the exception text) and a request id.
- **One orval run, two outputs.** The browser output is `react-query` with `httpClient: fetch`, `mode: split`, mocks on, `includeHttpResponseReturnType: false` (so `data` is the body, `data.status`) and the browser mutator. A second `fetch` output uses the server fetcher as its mutator, so Server Components call typed functions that cannot be imported into a Client Component (`server-only`). A third output writes Zod schemas. Generated files carry no banner details beyond orval's own header and live in `src/generated/`, excluded from lint, Prettier and coverage but type-checked.
- **Mutator and fetcher share `ApiError` and one `parseErrorResponse`.** Mutator extension points (`registerRequestInterceptor`, `setUnauthorizedHandler`) exist for E3-7 and E3-2 and ship with no behaviour.
- **Build order through Turborepo.** `api#openapi` depends on `api#build`; `generate` in `@heat/api-client` depends on `api#openapi`; root `pnpm generate` runs it. CI job `api-client-drift` runs `pnpm generate` and fails on any changed or new file under `apps/api/openapi.json` or `packages/api-client/src/generated`, listing them.

## Files

- `packages/contracts/src/errors.ts` (new), `src/index.ts`, `test/errors.test.ts`
- `apps/api/src/health/health.dto.ts`, `health.controller.ts`; `src/http/http.module.ts`, `api-exception.filter.ts`, `error-messages.ts`; `src/openapi/build-document.ts`, `serialize.ts`, `emit.ts`; `openapi.json`; `.prettierignore`; `package.json`; `app.module.ts`; tests under `apps/api/test/` mirroring these
- `packages/api-client/orval.config.ts`, `src/errors.ts`, `src/mutator/*`, `src/server/*`, `src/mocks.ts`, `src/index.ts`, `src/generated/**` (generated), `.prettierignore`, `package.json`, `vitest.config.mjs`; tests under `test/`
- `apps/frontend-public/test/api-client.test.ts`, `apps/frontend-internal/test/api-client.test.ts`
- `turbo.json`, `package.json`, `pnpm-workspace.yaml`, `packages/config/eslint/base.js`, `.github/workflows/ci.yml`
- `README.md`, `packages/api-client/CLAUDE.md`, root `CLAUDE.md` area row, `packages/config/test/docs.test.mjs`

## Acceptance criteria to proof

| Criterion | Proof |
| --- | --- |
| Health in the spec with its 200 schema equal to `healthResponseSchema`, no DB, Redis or server, env unset | `apps/api/test/openapi/build-document.test.ts` |
| Two builds are byte-identical, no absolute paths or env values | `apps/api/test/openapi/serialize.test.ts`, `emit.test.ts`; generation run twice with no diff (verify log) |
| Zod request DTO shows body, query and path parameters with constraints; validation failure returns the envelope with a stable code and field paths | `build-document.test.ts` (fixture controller), `test/http/api-exception.filter.test.ts` |
| One `errorResponseSchema`, closed code enum, test fails if a code is removed or changed | `packages/contracts/test/errors.test.ts` |
| Both frontends import the health hook and read `data.status`, `data` typed `{ status: "ok" }` | `apps/frontend-*/test/api-client.test.ts` under `pnpm typecheck` |
| Generated MSW health handler renders the hook deterministically | `packages/api-client/test/generated/health.test.tsx` |
| 4xx and 5xx envelope becomes `ApiError` with status, code, field paths | `packages/api-client/test/mutator/custom-fetch.test.ts` |
| Non-envelope, unknown code, network failure, abort give a fallback code and leak nothing | same file |
| Same-origin `/api` URL once, `credentials: "include"`, no `Content-Type` for bodiless and `FormData`, caller signal, 204 does not throw | same file |
| Interceptor and 401 handler called in order; default behaviour unchanged | `test/mutator/extensions.test.ts` |
| Server fetcher uses `API_INTERNAL_URL`, forwards only `Cookie`, never returns `Set-Cookie`, no redirect following, same `ApiError` | `test/server/server-fetch.test.ts` |
| Importing the server fetcher into a Client Component fails the build | `test/server/entry.test.ts` (entry starts with `server-only`, root export excludes it) plus a captured throwaway `next build` (verify log) |
| Missing `API_INTERNAL_URL` throws a clear error, no `localhost` fallback | `test/server/server-fetch.test.ts` |
| Drift job fails and names files; passes when clean; double run leaves no diff | deliberate drift on a throwaway change, captured in the verify log; `workflows.test.mjs` for pinning |
| Generated code skipped by lint, Prettier and coverage but type-checked; hand-written mutator and fetcher at least 85% | `pnpm lint`, `format:check`, `typecheck`, `test:coverage` in the verify log |

## Tasks

Each task: failing test first, see it fail for the right reason, least code, tick the box in the same commit.

- [x] **Task 1: Contracts error codes and envelope.** Tests: every code in a fixed expected list is still present; codes are unique and upper snake case; envelope parses a valid body with and without `fields`, rejects an unknown code. Add `errors.ts` (`errorCodes`, `clientErrorCodes`, `errorResponseSchema`, types) and export it. Commit `feat(contracts): add the error envelope and stable error codes (#28)`.
- [x] **Task 2: Spec document for the health endpoint.** Add `nestjs-zod`, `@nestjs/swagger`, `zod` to the API, `@scarf/scarf` to `allowBuilds`. Tests: document has `GET /api/health` with a 200 response equal to the health schema; a fixture controller with body, query and path DTOs shows constraints; builds with `DATABASE_URL` and `REDIS_URL` unset. Add `health.dto.ts`, `@ApiOkResponse`, `build-document.ts`. Commit `feat(api): describe the health endpoint with a contracts DTO and build the OpenAPI document (#28)`.
- [x] **Task 3: Stable serialization, emit script, committed spec.** Tests: key order independent of insertion order, trailing newline, two builds byte-identical, no absolute path in the output, file is written to the given path. Add `serialize.ts`, `emit.ts`, `openapi` script, `.prettierignore`, `openapi.json`. Commit `feat(api): emit a deterministic openapi.json at build time (#28)`.
- [x] **Task 4: Validation pipe and exception filter.** Tests through a Nest testing app: invalid body gives 400 `VALIDATION_FAILED` with `fields` paths and codes; 401, 403, 404, 429 and other 4xx map to codes with fixed messages; unknown error gives 500 `INTERNAL` with no message or stack in the body; request id taken from a valid `x-request-id` or generated, and echoed in the header; body always parses with `errorResponseSchema`. Add `http.module.ts`, `api-exception.filter.ts`, register in `AppModule`. Commit `feat(api): return the stable error envelope for every failure (#28)`.
- [x] **Task 5: `ApiError` and response parsing.** Tests: envelope gives status, code, fields, request id, `Retry-After` seconds (number and HTTP date); HTML, empty body and unknown code give `UNEXPECTED_RESPONSE` with the status kept and no body in the message. Add `src/errors.ts`. Commit `feat(api-client): add ApiError and one response error parser (#28)`.
- [x] **Task 6: Browser mutator and extension points.** Tests as in the table (URL, credentials, headers, signal, 204, error mapping, network, abort, interceptor then 401 handler then one retry, no handler registered). Add `src/mutator/custom-fetch.ts`, `extensions.ts`. Commit `feat(api-client): add the fetch mutator with CSRF and refresh extension points (#28)`.
- [x] **Task 7: Orval config and generated client.** Add dependencies (`orval`, `msw`, `@faker-js/faker`, `@tanstack/react-query`, testing library), `orval.config.ts`, the `generate` scripts, `turbo.json` tasks, lint/Prettier/coverage exclusions, first generation of `openapi.json` and `src/generated`. Tests: hook against the generated MSW handler returns `{ status: "ok" }`; type assertions in both frontends. Commit `feat(api-client): generate hooks, Zod schemas and MSW mocks with orval (#28)`.
- [x] **Task 8: Server fetcher.** Tests as in the table. Add `src/server/server-fetch.ts`, `index.ts`, second orval output, `exports` subpath, `next` peer and `server-only`. Commit `feat(api-client): add the server-only fetcher for Server Components (#28)`.
- [ ] **Task 9: CI drift job.** Add `api-client-drift` to `ci.yml` (SHA-pinned actions only), not required. Capture the deliberate-drift run (throwaway API change, no regeneration, failure names the files, then undo). Commit `ci: fail when the generated API client is out of date (#28)`.
- [ ] **Task 10: Docs.** `packages/api-client/CLAUDE.md`, root area row, `docs.test.mjs` area list, README (layout line, port 4000 vs the ticket's 3000, generate commands, drift job, `API_INTERNAL_URL`). Commit `docs: describe the generated API client and the drift check (#28)`.

## Verification

```sh
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build
pnpm audit:deps
pnpm generate && git status --porcelain   # twice: no change the second time
pnpm --filter @heat/ui build-storybook && pnpm --filter @heat/ui test:stories
```

Full log with result lines: the scratchpad `verify-28.md`, summarised in the pull request.
