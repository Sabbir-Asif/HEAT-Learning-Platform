# @heat/contracts

Zod schemas, enums, error codes and shared types. Compiles to `dist/` because the API imports it. Shared rules: [root CLAUDE.md](../../CLAUDE.md), including the error-format and validation lines under [Engineering](../../CLAUDE.md#engineering). This file adds only what is specific to the package.

## Rules

- The browser (React Hook Form) and the API (`nestjs-zod`) import the same schemas. Anything that must validate identically on both sides is defined here and nowhere else.
- Runs in the browser: no Node, Nest, Prisma or React imports.
- An error code is a public identifier: never rename it, never reuse it for another meaning. Add a code instead, and map it to a message in the frontends' catalogs.
- URL query parsers for list pages are defined here so the admin console and the API read the same parameters.
- Rich text JSON carries a `schemaVersion`; change it only with a migration path for stored content.
