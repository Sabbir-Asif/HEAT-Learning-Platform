# Migration review checklist

Use this list when a pull request changes `packages/db/prisma/migrations`. The author ticks it in the pull request; the reviewer checks it again. The rules behind it are in [packages/db/CLAUDE.md](../../packages/db/CLAUDE.md) and the Operations heading of the root [CLAUDE.md](../../CLAUDE.md).

## What CI already checks

- The `migrations` job fails when a migration directory that exists on the base branch is modified or deleted, and names the file.
- The same job applies every migration to an empty Postgres 17 database and fails when `prisma migrate diff` finds a difference from `prisma/schema`, so a schema change without a migration is caught.
- The `integration` job runs the same drift test again with the full test suite.

Everything below needs a human.

## Checklist

1. **Shape.** The change follows expand then contract: add the new column, table or index, backfill, switch the code, and remove the old one in a later release. The running version must keep working against the migrated database. A destructive step (drop, rename, type change, new `NOT NULL` without a default) is its own migration in a later pull request, never in the same one as the code that stops using the old shape.
2. **Reversibility.** Say in the pull request how to undo the migration: usually a follow-up migration, never an edit. If it cannot be undone, say so and say what the backup restore covers.
3. **One concern.** One migration does one thing. A data backfill is its own migration, after the schema step it depends on.
4. **Locks on large tables.** Name each statement that takes an `ACCESS EXCLUSIVE` or long `SHARE` lock (adding a column with a volatile default, changing a type, adding a constraint that scans the table, a plain `CREATE INDEX`). For tables that can grow large, use the lock-light form: `ADD CONSTRAINT ... NOT VALID` then `VALIDATE CONSTRAINT`, and `CREATE INDEX CONCURRENTLY` in its own migration. State the table's expected size.
5. **Defaults and backfills.** A new `NOT NULL` column has a default or is added nullable, backfilled, then constrained. Backfills run in batches, are safe to run twice, and do not rely on application code.
6. **Indexes.** Each new index has a query that needs it. Each foreign key column that is filtered or joined has an index. Partial and expression indexes that Prisma cannot express are written by hand in the SQL, with an integration test that the database rejects the bad row.
7. **Data loss.** Every `DROP`, `TRUNCATE`, `DELETE`, narrowing type change and `ON DELETE CASCADE` is listed in the pull request with what data it removes. Foreign keys to history use `Restrict`.
8. **Grants and protections.** New tables the app writes to have the grants the app user needs; the audit log stays append-only (its table triggers also stop the owner). The audit migration creates `heat_app` and so needs a migrating role with `CREATEROLE`; its grants cover `AuditLog` only, the API connects as `heat_app` or a member of it, and a migration that adds a table the API writes to adds that table's grants for `heat_app`.
9. **Personal data.** A column that stores personal data updates `docs/data-inventory.md`. A secret column is named `*Hash` and has its check constraint.
10. **Generated SQL.** The SQL came from `prisma migrate diff --from-schema <previous schema> --to-schema prisma/schema --script` with the `--` header lines removed (source files carry no comments), and was read line by line. `docs/data-model.md` is regenerated.
11. **Staging first.** The migration has run on staging against a copy of production-sized data before the release that needs it.
12. **Never edited after merge.** Fix a bad migration with a new one.
