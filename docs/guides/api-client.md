# API client

How the OpenAPI spec and the generated client are produced and used.

## API client

The API describes itself, and the browser and Server Components call it through code generated from that description (ADR 0015). Nothing is written by hand between the controllers and the hooks.

```sh
pnpm generate                      # build contracts and the API, emit the spec, run orval
pnpm --filter api openapi          # only the spec, after `pnpm --filter api build`
pnpm --filter @heat/api-client generate   # only orval, from the committed spec
```

1. Controllers use `nestjs-zod` DTOs built from `@heat/contracts` schemas and `@nestjs/swagger` decorators. `apps/api/src/openapi/` creates the application in preview mode (the module graph, no provider instantiated), so the spec needs no database, Redis or server. The output has sorted keys and no timestamp, path or environment value.
2. `apps/api/openapi.json` is committed, so an API change shows in the diff.
3. Orval 8 turns it into `packages/api-client/src/generated/`: TanStack Query hooks and MSW handlers (`client/`), plain typed functions for Server Components (`server/`) and Zod schemas (`zod/`). The generated files are committed, skipped by ESLint, Prettier and the coverage gate, and still type-checked.

| Import                     | For                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `@heat/api-client`         | Hooks, model types, `ApiError`, `registerRequestInterceptor`, `setUnauthorizedHandler`  |
| `@heat/api-client/server`  | `serverFetch` and the server functions; `server-only`, a Client Component cannot use it |
| `@heat/api-client/mocks`   | MSW handlers and response factories for tests and Storybook                             |
| `@heat/api-client/schemas` | Generated Zod schemas, for parsing responses (forms use `@heat/contracts`)              |

Errors have one shape: `{ "error": { "code", "message", "requestId", "fields": [{ "path", "code" }] } }`, with `code` from the closed list in `@heat/contracts`. A global filter in the API produces it with fixed message text. Both the browser mutator and the server fetcher throw an `ApiError` carrying the status, code, field paths, request id and `Retry-After`; when no envelope arrives (an Nginx error page, a network failure, an abort) the code is `UNEXPECTED_RESPONSE`, `NETWORK_ERROR` or `REQUEST_ABORTED`.

The server fetcher reads `API_INTERNAL_URL`, the API's address on the internal network (`http://api:4000` in Docker, `http://localhost:4000` locally; the API listens on 4000, not the 3000 written in the first design text). It throws a configuration error when the variable is missing and has no fallback. It forwards only the incoming `Cookie` header, does not follow redirects and does not cache unless asked. Pass `forwardCookies: false` inside `'use cache'` functions.

The CSRF header and the 401 refresh are not part of this package yet. They register through `registerRequestInterceptor` and `setUnauthorizedHandler` when their tickets land.
