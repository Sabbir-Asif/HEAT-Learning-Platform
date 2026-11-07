# 0014. Insights from daily rollups, not live scans

- Status: Accepted
- Date: 2026-11-07
- Plan: [D14, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

The Insights page shows enrollment trends and module and quiz results across date ranges, courses and academic groups. Queries over live tables would be slow and could slow down students.

## Decision

- A nightly BullMQ job, plus an on-demand refresh, aggregates enrollments, module progress and quiz attempts into small rollup tables by day, course, module and academic group.
- The Insights page reads only these rollups.
- Only aggregates are shown, groups smaller than 5 students are hidden, and the same data powers a CSV download of each chart.
- Event timestamps are recorded from day one, so later insights (video engagement, activity) need no backfill. Those insights are planned for v1.1.

## Consequences

- Charts load fast and never touch the tables students use.
- Data is as fresh as the last rollup unless an admin refreshes it.
- Small groups are hidden, which protects student privacy and makes some filter combinations show nothing.

## Alternatives considered

- Querying live tables for every chart. Named in the decision title: "not live scans".
