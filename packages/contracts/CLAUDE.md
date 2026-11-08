# @heat/contracts

Zod schemas, enums, error codes and shared types. Compiles to `dist/` because the API imports it. Shared rules: [root CLAUDE.md](../../CLAUDE.md), including the error-format line under [Engineering](../../CLAUDE.md#engineering). This file adds only what is specific to the package.

## Rules

- Validation schemas are defined only here. The browser (React Hook Form) and the API (`nestjs-zod`) import the same ones, so the two cannot drift.
- Runs in the browser: no Node, Nest, Prisma or React imports.
- An error code is a public identifier: never rename it, never reuse it for another meaning. Add a code instead, and map it to a message in the frontends' catalogs.
- URL query parsers for list pages are defined here so the admin console and the API read the same parameters.
- Rich text JSON carries a `schemaVersion`; change it only with a migration path for stored content.
- A field error code comes from the closed `fieldErrorCodes` list, never straight from Zod. Add a code there and map it in the API's exception filter.
