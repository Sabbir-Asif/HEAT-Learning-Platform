# Issue 41: Prisma schema for identity, directory, enrollment and catalog

Ticket: [#41](https://github.com/Sabbir-Asif/HEAT-Learning-Platform/issues/41), epic E2 (#4). Size L, label `security`: implementation waits for the owner's approval of this plan.

## Goal

Define the first half of the PostgreSQL schema in Prisma, with every integrity rule in the ticket enforced by the database, one migration per concern, a `@heat/contracts` check for the academic session format, an ER diagram in `docs/`, and integration tests that prove each rule against a real Postgres 17.

## Chosen approach

**Prisma 7.10.1** (the `latest` tag is an 8.0 release candidate, so the stable `prev` line is used), `prisma-client` generator, `@prisma/adapter-pg`, UUIDv7 keys through `@default(uuid(7))`. Alternatives weighed:

- Hand-written SQL migrations with Prisma only for the client: exact control of constraints, but the schema would no longer be the single source and the ER diagram and types would drift. Rejected.
- One initial migration for the whole schema: matches the ticket wording, but the root rule is one concern per migration. Chosen instead: four migrations (directory, identity, catalog, enrollment), applied in that order. Together they are "the initial migration" for the acceptance criterion, and `migrate deploy` on an empty database runs all four.
- Multi-file schema (`prisma/schema/*.prisma`, one file per concern) so E2-2 adds files instead of growing one. Chosen.

Decisions that the ticket leaves open, settled here:

- **No comments in `.prisma` files** (root rule covers config and source). The "data inventory comment" the ticket asks for is delivered as `docs/data-inventory.md`, prose, listing every personal-data column for E15-6.
- **Email uniqueness is not enforced in this ticket.** The partial unique index on active emails is E2-3. `User.email` gets a plain index so the later migration only adds the partial unique index. Until E2-3 lands, nothing may rely on uniqueness.
- **Module and video order uniqueness** is a plain unique constraint, as the ticket asks. Reordering inside one statement can collide; E7 must reorder in two steps or this constraint gets made deferrable then. Noted in the E7 ticket, not solved here.
- **`Enrollment.courseRevisionId` is nullable.** Per ADR 0011 the pin is set at approval, so pending enrollments have none. A check constraint requires it for APPROVED, COMPLETED and REMOVED-after-approval states.
- **Admin TOTP** lives in `AdminCredential` (one row per admin, encrypted secret as `Bytes`) and `RecoveryCode` (hashed). Encryption itself is E3-3; the schema only stores ciphertext.
- **Integration tests** run through Testcontainers from `packages/db/test/integration`, with one shared Postgres 17 container per run and one fresh database per test file. This is the minimum #41 needs; #45 generalises it (factories, Nest module, isolation strategy) and is blocked by this ticket.
- **ER diagram** is generated from Prisma's DMMF into `docs/data-model.md` as Mermaid by a small script, with a test that fails when the committed file is stale. No browser-based generator dependency.
- **Soft delete** columns (`deletedAt`) are added where the plan requires; filtering is E2-3.

## Files

Create:

- `packages/db/prisma.config.ts`
- `packages/db/prisma/schema/base.prisma` (datasource, generator)
- `packages/db/prisma/schema/directory.prisma`, `identity.prisma`, `catalog.prisma`, `enrollment.prisma`
- `packages/db/prisma/migrations/*` (four, generated)
- `packages/db/src/client.ts` (client factory over the pg adapter), `src/index.ts` re-exports
- `packages/db/bin/er-diagram.mjs`, `packages/db/src/er-diagram.ts`
- `packages/db/test/integration/global-setup.ts`, `helpers.ts`, `directory.integration.test.ts`, `identity.integration.test.ts`, `catalog.integration.test.ts`, `enrollment.integration.test.ts`, `migrate.integration.test.ts`
- `packages/db/test/er-diagram.test.ts`, `test/schema.test.ts`
- `packages/db/vitest.integration.config.mjs`
- `packages/contracts/src/academic-session.ts`, `packages/contracts/test/academic-session.test.ts`
- `docs/data-model.md` (generated), `docs/data-inventory.md`

Change:

- `packages/db/package.json` (deps, `generate`, `test:integration`, build order), `.gitignore` (generated client), `turbo.json` (generate before build, typecheck, test), `packages/contracts/src/index.ts`, `packages/db/CLAUDE.md` (how to add a migration, how to run integration tests), `README.md` (db commands)

## Schema outline

Enums: `UserRole` (SUPER_ADMIN, ADMIN, STUDENT), `Realm` (STUDENT, ADMIN), `AuthTokenPurpose` (VERIFY_EMAIL, RESET_PASSWORD, INVITE, PASSWORD_CODE), `EnrollmentStatus` (PENDING_VERIFICATION, PENDING_APPROVAL, APPROVED, COMPLETED, REJECTED, EXPIRED, REMOVED), `DecisionAction` (APPROVE, REJECT, REMOVE, REINSTATE), `CourseStatus` (DRAFT, PUBLISHED), `VideoAssetStatus` (UPLOADING, UPLOADED, QUEUED, PROCESSING, READY, FAILED, REJECTED), `ProfileChangeStatus` (PENDING, APPROVED, REJECTED).

Every table: `id` UUIDv7, `createdAt`, `updatedAt`. `deletedAt` on User, StudentProfile, Enrollment, Course, CourseRevision, Module, LessonSection, Video, Tag. `archivedAt` on University, Faculty, Department.

| Concern    | Tables and the rule that matters                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Directory  | `University`, `Faculty`, `UniversityFaculty` (composite key university, faculty), `Department` with composite FK (`universityId`, `facultyId`) to `UniversityFaculty`; all directory FKs `ON DELETE RESTRICT`                                                                                                                                                                                                                       |
| Identity   | `User` (email, `passwordHash`, role, realm, `emailVerifiedAt`, `mustChangePassword`, `deactivatedAt`), `StudentProfile` (1:1, English name, `departmentId`, `session`), `Session` (`refreshTokenHash`, `familyId`, `rotatedAt`, `revokedAt`, user agent, IP), `AuthToken` (`tokenHash` SHA-256 hex, purpose, `expiresAt`, `usedAt`), `AdminCredential`, `RecoveryCode` (`codeHash`, `usedAt`), `ProfileChangeRequest`               |
| Catalog    | `Course` (slug unique, status, `lockedAt`), `CourseRevision` (unique course, number), `Module` (unique revision, `order`), `LessonSection`, `VideoAsset` (`assetKey` unique, status, `referenceCount`), `Video` (unique module, `order`; FK to `VideoAsset`), `VideoRendition`, `VideoCaption` (unique video, language), `Tag` (`isSystem`, slug unique), `CourseTag`, `ModuleTag` (display order), `SiteSetting` (key, JSON value) |
| Enrollment | `Enrollment` (unique user, course; nullable `courseRevisionId`; `statusBeforeRemoval`; event timestamps `requestedAt`, `verifiedAt`, `approvedAt`, `rejectedAt`, `removedAt`, `completedAt`, `expiredAt`), `EnrollmentDecision` (action, admin, reason, `decidedAt`)                                                                                                                                                                |

No column stores a raw token, refresh token, recovery code or disk path: the columns are `tokenHash`, `refreshTokenHash`, `codeHash` and `assetKey`.

## Tasks

Each task: test first, see it fail for the right reason, minimal change, see it pass, commit. Tests live in `test/` mirroring `src/`. Commit format `<type>(<scope>): <summary> (#41)`.

- [x] **1. Tooling.** Add `prisma@7.10.1`, `@prisma/client@7.10.1`, `@prisma/adapter-pg`, `pg`, `@types/pg`, `testcontainers`, `@testcontainers/postgresql` to `@heat/db` (versions pinned, no ranges, at least the repository's minimum release age). Add `prisma.config.ts` reading `DATABASE_URL` from the environment, the `generate` script, `base.prisma`, the generated client path in `.gitignore`, `turbo.json` ordering (`generate` before `build`, `typecheck`, `test`). Test: `test/schema.test.ts` asserts `src/client.ts` exports `createClient` and that `createClient("postgresql://x")` returns an object with `$disconnect`. Fails now: no `client.ts`. Commit `chore(db): set up Prisma 7 with the pg adapter (#41)`.
- [x] **2. Integration harness.** `vitest.integration.config.mjs` with `global-setup.ts` that starts one `postgres:17-alpine` container, exposes its URL, and `helpers.ts` with `withDatabase()` creating a fresh database per test file and running `prisma migrate deploy` against it. Script `test:integration`. Test: `migrate.integration.test.ts` runs `withDatabase()` on an empty Postgres and expects `_prisma_migrations` to list every migration directory and the `pg_tables` query to return the schema's tables (the file grows with each migration task). Fails now: no migrations or harness. Verify the container stops after the run (`docker ps` shows none left). Commit `test(db): Testcontainers harness for schema tests (#41)`.
- [x] **3. Session format in contracts.** `academicSessionSchema`: matches `^\d{4}-\d{2}$` and the two-digit part equals the next year's last two digits (`2020-21` valid; `2020-23`, `20-21`, `2099-00` handled: `2099-00` valid). Test cases: `2020-21`, `1999-00`, `2020-23`, `20-21`, `2020-2`, empty, `2020-21 ` (trailing space, invalid). Fails now: export missing. Also exports the `fieldErrorCodes` entry if the closed list requires it (read `errors.ts` first). Commit `feat(contracts): academic session schema (#41)`.
- [x] **4. Directory migration.** Tests in `directory.integration.test.ts`: (a) a department for a faculty not linked to its university is rejected with a foreign key violation (code `23503`); (b) deleting a university that has linked faculties, a department or a student profile is rejected (`23503`); same for faculty and department; (c) archiving sets `archivedAt` and does not delete. Fails now: tables do not exist. Write `directory.prisma`, generate migration `directory`, run. Commit `feat(db): directory schema and migration (#41)`.
- [x] **5. Identity migration.** Tests: (a) `Session`, `AuthToken` and `RecoveryCode` have only `*Hash` columns and no column named `token`, `refreshToken` or `code` (information_schema query); (b) hash columns reject values that are not 64 hex characters (check constraint `char_length = 64`); (c) one `StudentProfile` per user (unique); (d) `AdminCredential` is one per admin; (e) a student profile cannot reference a missing department. Commit `feat(db): identity schema and migration (#41)`.
- [x] **6. Catalog migration.** Tests: (a) two modules with the same `order` in one revision fail (`23505`), same order in different revisions pass; (b) same for video order per module; (c) a video references `VideoAsset` through `assetKey`-keyed asset and no column named `path`, `url` or `filePath` exists on catalog tables; (d) `Course.slug` and `VideoAsset.assetKey` are unique; (e) tag `isSystem` rows can be created for `frontpage` with a unique slug. Commit `feat(db): catalog schema and migration (#41)`.
- [x] **7. Enrollment migration.** Tests: (a) a second enrollment for the same user and course fails (`23505`); (b) an APPROVED or COMPLETED enrollment without `courseRevisionId` fails the check constraint, a PENDING one without it passes; (c) deleting a user, course revision or admin referenced by an enrollment or decision is restricted; (d) decisions require an admin. Commit `feat(db): enrollment schema and migration (#41)`.
- [ ] **8. Clean deploy.** `migrate.integration.test.ts` final form: empty Postgres 17, `migrate deploy` exits 0, a second `migrate deploy` is a no-op, and `prisma migrate diff --from-migrations ... --to-schema ... --exit-code` reports no drift. Commit `test(db): migrations apply cleanly and match the schema (#41)`.
- [ ] **9. ER diagram and data inventory.** `er-diagram.ts` turns the DMMF into Mermaid; `bin/er-diagram.mjs` writes `docs/data-model.md`; `test/er-diagram.test.ts` fails when the committed file differs from the generated one and asserts every model appears. Write `docs/data-inventory.md` (personal data: name, email, session, IP, user agent; where stored; who reads). Commit `docs(db): ER diagram and personal data inventory (#41)`.
- [ ] **10. Docs.** Update `packages/db/CLAUDE.md` and README (generate, migrate dev, integration tests need Docker) and tick the reference table only if a row applies (none does). Commit `docs(db): how to change the schema and run its tests (#41)`.

## Acceptance criteria to proof

| Criterion                                                     | Proof                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------- |
| Second enrollment for the same user and course is rejected    | Task 7 (a), `enrollment.integration.test.ts`                  |
| Department under an unlinked faculty is rejected              | Task 4 (a), composite FK                                      |
| Hard delete of a referenced university is restricted          | Task 4 (b)                                                    |
| Duplicate module order per revision, video order per module   | Task 6 (a), (b)                                               |
| `2020-21` passes; `2020-23` and `20-21` fail, browser and API | Task 3; the schema is in `@heat/contracts`, which both import |
| Only SHA-256 hashes stored for tokens                         | Task 5 (a), (b)                                               |
| Videos referenced by `assetKey`, never a disk path            | Task 6 (c)                                                    |
| `prisma migrate deploy` applies on empty Postgres 17          | Task 8                                                        |
| ER diagram in `docs/`                                         | Task 9                                                        |

## Verification (stage 6)

```sh
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build
pnpm --filter @heat/db test:integration
pnpm --filter @heat/db generate && git diff --exit-code
docker ps
```

Then `pnpm verify` on a clean tree. Also confirm the CI `integration` job passes on the pull request (it runs `pnpm -r --if-present run test:integration` and needs `generate` first; check `ci.yml` in task 2 and add the step if it is missing).

## Risks and open points

- Prisma 7 changes (config file, no `url` in the datasource, generated client location) are new to this repository; task 1 is where surprises show up.
- The pnpm minimum release age may block a freshly published package version; pin an older patch if so, do not add an exclusion without the owner.
- The `integration` job needs Docker on the CI runner; GitHub-hosted runners have it.
