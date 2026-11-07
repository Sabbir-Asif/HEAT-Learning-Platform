# 0010. Hooks guide, CI and branch protection enforce

- Status: Accepted
- Date: 2026-11-07
- Plan: [D10, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

Many tickets are delivered by AI agents. Claude Code hooks are shell commands that run on events, and some can be bypassed through other tools, so they cannot be the only control.

## Decision

- An `/implement-issue` skill drives the eight workflow stages (plan section 12).
- Hooks act as guard rails.
- The hard gates are branch protection and CI: nothing merges without green checks, and only the owner merges.

## Consequences

- A bypassed hook cannot put unchecked code on `main`.
- Required status checks must stay reliable. Slow or flaky checks (Lighthouse, screenshots) warn on pull requests instead of blocking them.
- ADR changes always go through the owner.

## Alternatives considered

- Hooks as the enforcement. Named in the plan: some hooks can be bypassed through other tools.
- Requiring one approving review. Named in the plan's review: it cannot be met, because GitHub does not let an author approve their own pull request. The owner chose passing CI and owner-only merge instead.
