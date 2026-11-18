# Database and rollups

Schema, seed, integration tests and the nightly insight rollups.

## Database

The schema is in `packages/db/prisma/schema/`, one file per concern, and the generated client in `packages/db/src/generated/` is not committed. Turborepo runs `prisma:generate` before build, lint, typecheck and test, so a fresh checkout needs only `pnpm install`.

```sh
pnpm --filter @heat/db prisma:generate     # regenerate the client after a schema change
pnpm --filter @heat/db test:integration    # schema tests on Postgres 17 in Testcontainers; needs Docker
pnpm --filter @heat/db er-diagram          # rewrite docs/data-model.md from the schema
SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... DATABASE_URL=... pnpm --filter @heat/db exec prisma db seed
```

The seed creates the super admin (who must change the password at first sign-in), the University of Dhaka and the `frontpage` tag. Add `SEED_SAMPLE_DIRECTORY=true` in development and staging for sample faculties and departments; production leaves it unset. Details are in `packages/db/CLAUDE.md`.

`docs/data-inventory.md` lists the personal data columns; a schema change that adds one updates it in the same pull request.

## Insights rollups

The worker rebuilds the insight rollup tables every night at 02:00 Asia/Dhaka for yesterday and today, and an admin refresh (`POST /api/admin/insights/refresh`) queues the same rebuild. Days are Asia/Dhaka days, so the boundary is midnight in Dhaka, not UTC. Only one run can be active at a time; a second refresh answers 409 `INSIGHTS_REFRESH_RUNNING`. To rebuild history for a date range, build the API and run it with the database settings of the target environment:

```sh
pnpm --filter api insights-backfill --from 2026-11-01 --to 2026-11-30
```

The command refuses to start while another run is active. Rebuilding a day is idempotent, so a range can be rerun safely.
