# @heat/db

Prisma schema, migrations and client. Compiles to `dist/` because the API imports it. Shared rules: [root CLAUDE.md](../../CLAUDE.md), including the migration, integration-test and expand-then-contract rules under [Engineering](../../CLAUDE.md#engineering) and [Operations](../../CLAUDE.md#operations). This file adds only what is specific to the package.

## Rules

- Every schema change is a new migration. Commit the generated SQL with the schema change that produced it.
- One concern per migration. Put data backfills in their own migration, after the schema step they depend on.
- Grants and database-level protections (the append-only audit log) are migrations too, so a fresh database gets them.
- Record event timestamps on every table that later insights read, from the first migration, so nothing needs a backfill.
- Only the API and the worker import the client, through this package. The frontends never import it.
