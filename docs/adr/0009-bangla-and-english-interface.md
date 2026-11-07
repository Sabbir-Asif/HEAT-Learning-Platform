# 0009. Bangla and English interface from day one

- Status: Accepted
- Date: 2026-11-07
- Plan: [D9, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

The demo has a বাংলা / English toggle. Retrofitting translation after screens exist touches every screen.

## Decision

- Interface strings and emails go through `next-intl` from the first screen. Catalogs live in `@heat/i18n`.
- The student app puts the language in the path (`/bn/...`, `/en/...`). The admin app is English only (from the frontend design spec).
- Course content is in one language per course for v1. The schema is ready for translations later.

## Consequences

- No hard-coded user-facing strings in the apps.
- Every string and email needs both languages before a ticket is done.
- The font must render Bangla correctly at every weight used.

## Alternatives considered

- English only first and translating later. Named in the plan's rationale: "so translation is never a retrofit".
- Translating course content in v1. Not chosen: the plan keeps one language per course and leaves the schema ready.
