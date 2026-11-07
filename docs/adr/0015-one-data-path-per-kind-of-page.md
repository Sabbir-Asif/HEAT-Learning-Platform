# 0015. One data path per kind of page

- Status: Accepted
- Date: 2026-11-07
- Plan: [D15, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

Two Next.js apps with many AI-written screens need one way to fetch data, one auth path and one CSRF path. Details are in the [frontend design spec](../superpowers/specs/2026-11-07-frontend-architecture-design.md).

## Decision

- Public pages render on the server and are cached by tag.
- Signed-in pages check the session in a server-only data layer and prefetch on the server.
- All interactive calls go from the browser to the API through generated hooks (orval with TanStack Query).
- No Server Actions.
- Sessions refresh in `proxy.ts`.
- URL state uses nuqs. There is no global client store: Zustand is dropped, because URL state, TanStack Query and local component state cover every case.

## Consequences

- The API stays the single authority for business rules, with one auth and CSRF path.
- Auth checks live in the data layer and in each page's data calls, never only in a layout.
- The generated client must stay in step with the API's OpenAPI spec, which CI checks.

## Alternatives considered

- Server Actions for mutations. Named in the plan and rejected: they would add a second path for auth and CSRF.
- Zustand for client state. Named in the frontend design spec and dropped: the three mechanisms above cover every case.
- Two ways to call the API. Named in the frontend design spec as an anti-goal.
