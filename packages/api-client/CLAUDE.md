# @heat/api-client

Generated TanStack Query hooks, Zod schemas and MSW mocks for the HTTP API, plus the fetch mutator and the server fetcher. Ships TypeScript source, which the Next.js apps compile. Shared rules: [root CLAUDE.md](../../CLAUDE.md), including the generated-hooks line under [Engineering](../../CLAUDE.md#engineering). This file adds only what is specific to the package.

## Rules

- Never edit `src/generated/` or `apps/api/openapi.json`. Change the API, run `pnpm generate` from the repository root and commit both. The `api-client-drift` CI job fails on a stale copy and lists the files.
- Operation names come from the controller and method: `HealthController.check` becomes `useHealthCheck`. Renaming a controller or method renames the hook for every screen.
- Browser code imports hooks, `ApiError` and the extension functions from `@heat/api-client`. Server Components, Route Handlers and the data access layer import from `@heat/api-client/server`, which starts with `server-only` and reads `API_INTERNAL_URL`. MSW handlers come from `@heat/api-client/mocks` and belong in tests and Storybook only.
- Forms validate with `@heat/contracts` schemas. The generated Zod schemas in `@heat/api-client/schemas` are for parsing responses.
- Every failed call throws an `ApiError`. Screens branch on its `code` and show their own translated text; its `message` is the code, never server text.
- Inside a `'use cache'` function call the server fetcher with `forwardCookies: false`, because cached functions cannot read request headers and must not hold per-user data.
- The CSRF header (E3-7) and the 401 refresh and retry (E3-2) plug in through `registerRequestInterceptor` and `setUnauthorizedHandler`. Do not fork the mutator.
- Hand-written code is `src/errors.ts`, `src/transport.ts`, `src/mutator/` and `src/server/`, held to the 85% coverage gate. Orval is pinned to an exact version so a bump shows up as a reviewed diff in the generated files.
