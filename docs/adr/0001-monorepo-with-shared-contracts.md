# 0001. pnpm + Turborepo monorepo with shared contracts

- Status: Accepted
- Date: 2026-11-07
- Plan: [D1, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

The platform has two Next.js apps, a NestJS API and a worker. Many tickets are written by AI agents across all of them, so frontend and backend validation must not be able to drift apart.

## Decision

- One repository, managed with pnpm workspaces and Turborepo, holds `frontend-public`, `frontend-internal`, `api` and `worker`, plus the shared packages.
- A single `@heat/contracts` package holds the Zod schemas. React Hook Form uses them in the browser and `nestjs-zod` uses them in the API.
- The same package carries the shared enums and the stable error codes.

## Consequences

- A schema change is one change, reviewed once, and breaks the build on both sides if either is out of step.
- The apps and packages share one lockfile, one toolchain and one CI run, driven by Turborepo.
- Package boundaries need care: `@heat/contracts` must stay free of app code so every app can import it.

## Alternatives considered

- Separate repositories for the frontends and the backend, with schemas copied or published between them. Derived from the plan's rationale, not named in it: it allows the validation rules to drift, which the plan rules out.
