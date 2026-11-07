# 0013. One component library, minimal CSS

- Status: Accepted
- Date: 2026-11-07
- Plan: [D13, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

Many AI-written tickets build two apps. Without one source of styles the screens drift, and the owner wants very little CSS, a professional modern look and no filler.

## Decision

- `@heat/ui` is the only place styles are written: shadcn components themed by design tokens, plus composite components shared by both apps (page header, data table, form field, status badge, empty state, confirm dialog, stat card, file upload).
- Apps compose these and use Tailwind only for layout.
- No one-off CSS files, no arbitrary values outside the tokens, and no component on a screen unless the task needs it.
- The video player is a `@heat/ui` composite built on Video.js v10 and hls.js (frontend design spec).

## Consequences

- Both apps look and behave the same, and a style change is made once.
- New UI needs a shared component first, then use in the app.
- The styling rules are enforced by lint, see [packages/ui/CLAUDE.md](../../packages/ui/CLAUDE.md).

## Alternatives considered

- App-level CSS files and one-off styles. Named in the frontend design spec as an anti-goal.
- Decorative components and banners. Named in the plan's quality bar as filler.
- Vidstack for the player. Named in the frontend design spec: dropped, because Video.js v10 supersedes it and it is in security-only maintenance.
