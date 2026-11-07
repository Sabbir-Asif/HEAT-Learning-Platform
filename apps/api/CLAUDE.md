# api

NestJS HTTP API, global prefix `/api`, port 4000. A modular monolith. Shared rules: [root CLAUDE.md](../../CLAUDE.md), including [Security](../../CLAUDE.md#security) and [Engineering](../../CLAUDE.md#engineering). Request and response schemas and error codes are defined in [contracts](../../packages/contracts/CLAUDE.md). This file adds only what is specific to the API.

## Rules

- One Nest module per domain with strict boundaries: a module reaches another only through that module's exported providers, never its internals or its database tables.
- The API is the single authority for business rules. The frontends only call it.
- Write a domain event to the Outbox table in the same transaction as the state change; the relay hands it to BullMQ. Never enqueue a job or send mail straight from a request.
- Take locks and approvals inside the transaction that changes the state (for example the course content lock on first approval), so they cannot race.
- Shared providers that the worker also uses live in `src/core` and are exported as `api/core`. Nothing in `core` may depend on HTTP, controllers or guards.
- Files and images go through the `media` module and the storage interface. Records store asset IDs, never URLs.
- A controller returns and accepts `createZodDto(contractsSchema)` classes and declares its response with `@ApiOkResponse`, so the schema in `@heat/contracts` is the one in the spec. `ZodValidationPipe` and `ApiExceptionFilter` are registered globally in `HttpApiModule`; throw Nest exceptions and let the filter shape the error.
- The operation id is the controller name without `Controller` plus the method name, which gives the generated hook its name. Rename a controller or method knowing the hook changes.
- After any change to a route or DTO run `pnpm generate` and commit `openapi.json` with the generated client. A test in this package fails when the committed spec is stale.
