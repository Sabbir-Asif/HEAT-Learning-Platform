---
paths:
  - "packages/db/prisma/migrations/**/*.sql"
---

# Migrations

- A merged migration is never edited. Fix it with a new migration.
- One concern per migration; a backfill is its own migration after the schema step it depends on.
- Follow expand then contract: add, backfill, switch, remove later, so a deploy never breaks the running version.
- No `--` comment lines in the SQL. Delete the header Prisma writes.
- Raw SQL for rules Prisma cannot express needs an integration test in `packages/db/test/integration/` that makes the database reject the bad row.
- Never run `prisma migrate reset`. Deploys use `migrate deploy`.
