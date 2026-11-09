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
- Integration tests use the harness in `src/testing` (`@heat/db/testing`): a migrated template database cloned per test, see README, Integration tests. It is compiled into `dist` but only test code imports it, and it keeps its Testcontainers dependencies in `devDependencies`.

## Soft delete

`createClient` returns a client extended in `src/soft-delete.ts`. For the models below, reads (`findMany`, `findFirst`, `findUnique`, `count`, `aggregate`, `groupBy`), `update`, `updateMany` and `upsert` skip rows with `deletedAt` set, `delete` and `deleteMany` set `deletedAt` instead of removing the row, and every other model keeps normal behaviour.

- Soft-deleted: `User`, `StudentProfile`, `Enrollment`, `Course`, `CourseRevision`, `Module`, `LessonSection`, `Video`, `Tag`, `Quiz`, `Question`, `MediaAsset`, `Resource`, `NewsPost`.
- Directory models use `archivedAt`, not soft delete.
- `client.$includingDeleted()` returns a client that also reads soft-deleted rows. Use it only for admin views, retention jobs and audit views. Its `delete` still soft-deletes.
- Acting on a deleted row through the normal client behaves as not found: `update` and a repeated `delete` throw `P2025`, and `upsert` on a deleted unique key tries to create and fails with `P2002` when the key is the primary key. Setting `deletedAt` in `data` of `update`, `updateMany` or `upsert` throws, so a row cannot be resurrected; only `$includingDeleted()` can write it.
- The filter applies to the queried model only. Nested `include`, `select` and nested writes on relations are not filtered or checked (a test pins this), so services must add `where: { deletedAt: null }` to every relation they load.
- Soft delete never triggers a database RESTRICT. Services check usage first with `assertNotInUse([{ name, count }])`, which throws `RecordInUseError` listing what blocks the delete.
- Email is unique among active users only: the `User_email_active_key` partial unique index on `lower("email") WHERE "deletedAt" IS NULL` is raw SQL in migration `20261109110000_user_email_active_unique`.
- A new model with `deletedAt` must be added to `softDeletedModels`; a unit test fails when the list and the schema differ.

## Seed

`pnpm --filter @heat/db exec prisma db seed` runs `src/seed-cli.ts` (configured in `prisma.config.ts`) against `DATABASE_URL`. It is idempotent: every row is an upsert keyed by its natural key, so a re-run changes nothing.

- Always seeded: the super admin (`SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, at least 12 characters), the University of Dhaka and the reserved `frontpage` system tag.
- The super admin is `SUPER_ADMIN` in the `ADMIN` realm with `mustChangePassword` set, no TOTP, and an argon2id hash from `src/password.ts`. If a user with that email already exists the seed leaves it untouched, so a re-run never resets its password; it fails if that user is not a super admin.
- Empty or missing super admin variables fail with a clear message before anything is written. The password is never logged.
- Sample faculties and departments (linked through `UniversityFaculty`) are seeded only when `SEED_SAMPLE_DIRECTORY=true`. Leave it unset in production.
- Seed tests are in `test/integration/seed.integration.test.ts`.
