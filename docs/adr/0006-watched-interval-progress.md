# 0006. Watched-interval progress the server can trust

- Status: Accepted
- Date: 2026-11-07
- Plan: [D6, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

The quiz opens only after a student has watched 80% of each required video. The browser reports what was watched, so a script could report a whole video as watched.

## Decision

- The player sends watched ranges every 15 seconds and on pause, seek or tab hide.
- The server accepts ranges only up to the wall-clock time since the playback session started, multiplied by the highest allowed playback speed. Late batches from an offline retry are accepted within the same budget.
- A video counts as complete at 80% coverage or more. Skipped parts do not count.
- The resume position is stored separately and never moves backwards from a stale request.
- Heartbeats are batched writes. Redis buffering is added only if load tests show a need.

## Consequences

- Cheating by script is bounded by real elapsed time.
- Requests carry sequence numbers so stale ones are ignored.
- Heartbeat volume is a load-test item for the video phase.

## Alternatives considered

- Trusting the ranges the browser reports. Named in the plan's review as a high-severity finding: a script could pass the 80% rule.
- Buffering heartbeats in Redis from the start. Named in the plan and deferred until load tests show a need.
