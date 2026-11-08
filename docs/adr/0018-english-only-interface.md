# 0018. English only interface

- Status: Proposed
- Date: 2026-11-08
- Plan: [D9, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

[0009](0009-bangla-and-english-interface.md) put the interface in two languages from the first screen. On 2026-11-08 the owner decided that the platform needs one language, English, and asked for the second language and every multi-language feature to be removed.

## Decision

- The interface, emails and certificates are in English only.
- No translation library, no message catalog package, no language switch, no language segment in any address, and no language-specific font or line-height rules.
- Course content is in one language per course, which is English.
- Fonts come from the design tokens: Source Serif 4 for display and headings, Public Sans for interface text.

## Consequences

- Strings are written in the components. If a second language is ever needed, a new decision record introduces it.
- Tickets that planned `next-intl`, `@heat/i18n`, `/bn` and `/en` routes or two-language emails must be reworded before they are built. They are listed on #181 for the owner.
- Tests and docs no longer ask for a second language.

## Alternatives considered

- Keep the two-language structure and ship English first. Not chosen: the owner asked for removal, and an unused structure costs every screen ticket.
