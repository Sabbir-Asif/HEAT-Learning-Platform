# @heat/db

Prisma schema, migrations and client. Compiles to `dist/` because the API imports it. Shared rules: [root CLAUDE.md](../../CLAUDE.md), including the migration, integration-test and expand-then-contract rules under [Engineering](../../CLAUDE.md#engineering) and [Operations](../../CLAUDE.md#operations). This file adds only what is specific to the package.

## Rules

- Every schema change is a new migration. Commit the generated SQL with the schema change that produced it.
- One concern per migration. Put data backfills in their own migration, after the schema step they depend on.
- Grants and database-level protections (the append-only audit log) are migrations too, so a fresh database gets them.
- Record event timestamps on every table that later insights read, from the first migration, so nothing needs a backfill.
- Only the API and the worker import the client, through this package. The frontends never import it.
- The schema is split by concern in `prisma/schema/`, with no comments. Rules Prisma cannot express (check constraints, partial indexes) go into that migration's SQL by hand, with a test in `test/integration/` that makes the database reject the bad row.
- Make the migration SQL with `prisma migrate diff --from-schema <previous schema> --to-schema prisma/schema --script`, so no development database is needed. `test/integration/migrate.integration.test.ts` fails when the migrations and the schema drift apart. Delete the `--` header lines Prisma writes before committing, because source files carry no comments.
- Foreign keys to history (enrollments, decisions, content, directory) use `onDelete: Restrict`. Cascade is only for rows that belong to one user and hold credentials or sessions.
- A column that stores a secret is named `*Hash` and has a check constraint for the 64-character SHA-256 form; the raw value never reaches the database.
- A schema change regenerates `docs/data-model.md` and updates `docs/data-inventory.md` when it adds personal data.
