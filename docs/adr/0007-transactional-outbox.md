# 0007. Transactional outbox for email and jobs

- Status: Accepted
- Date: 2026-11-07
- Plan: [D7, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

State changes (enrolled, verified, completed) must trigger emails and jobs. Neither a lost email nor a duplicate certificate is acceptable.

## Decision

- Domain events are written to an `Outbox` table in the same database transaction as the state change.
- A relay then moves them to BullMQ.
- No email or certificate is lost if Redis restarts, and none is sent twice.

## Consequences

- Delivery is decoupled from the request: the transaction commits first and the relay delivers afterwards.
- The relay can deliver an event more than once, so consumers must be idempotent. That, with the outbox, gives the plan's result of nothing lost and nothing sent twice.
- The relay and the outbox table need monitoring, for example queue depth on the dashboards.
- Passing the last module writes `CertificateRequested` to the outbox in the same transaction.

## Alternatives considered

- Adding jobs to BullMQ directly from the request handler. Derived from the plan's rationale, not named in it: the database and Redis cannot commit together, so a Redis restart could lose an event or a retry could send it twice.
