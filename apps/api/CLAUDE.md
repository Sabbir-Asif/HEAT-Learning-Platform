# api

NestJS HTTP API, global prefix `/api`, port 4000. A modular monolith. Shared rules: [root CLAUDE.md](../../CLAUDE.md), including [Security](../../CLAUDE.md#security) and [Engineering](../../CLAUDE.md#engineering). This file adds only what is specific to the API.

## Rules

- One Nest module per domain with strict boundaries: a module reaches another only through that module's exported providers, never its internals or its database tables.
- The API is the single authority for business rules. The frontends only call it.
- Request and response shapes come from `@heat/contracts` through `nestjs-zod`. Do not define a second schema here.
- Return errors in the shared format with the stable codes from `@heat/contracts`.
- Write a domain event to the Outbox table in the same transaction as the state change; the relay hands it to BullMQ. Never enqueue a job or send mail straight from a request.
- Take locks and approvals inside the transaction that changes the state (for example the course content lock on first approval), so they cannot race.
- Shared providers that the worker also uses live in `src/core` and are exported as `api/core`. Nothing in `core` may depend on HTTP, controllers or guards.
- Files and images go through the `media` module and the storage interface. Records store asset IDs, never URLs.
- Never log request bodies, cookies or tokens.
