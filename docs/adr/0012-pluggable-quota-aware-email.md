# 0012. Pluggable, quota-aware email

- Status: Accepted
- Date: 2026-11-07
- Plan: [D12, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

Launch uses a personal Gmail account, about 500 emails a day, and each student gets at least 3 emails. Intake therefore runs in small cohorts. The plan's review found that the daily limit combined with the 7-day expiry could delete real registrations, and that resend could burn the quota.

## Decision

- A `MailTransport` interface with an SMTP implementation chosen by configuration. Personal Gmail is first, and changing provider is a settings change.
- All mail goes through a BullMQ queue, with a Redis counter for the rolling 24-hour limit.
- The limit is split into per-category budgets, so verification, password codes and resets always have capacity before approval and certificate mail.
- When a budget is used up, jobs wait until it frees instead of failing. Gmail quota errors (550 5.4.5) pause the queue the same way.
- Resend-verification and forgot-password require the captcha and are capped per email.
- The 7-day expiry for unverified registrations is counted from the actual send, that is, from when the verification email is actually sent.
- Gmail SMTP gives no bounce reports, so failures are tracked from SMTP responses only.

## Consequences

- Critical mail keeps flowing while bulk mail waits.
- A delayed email is not a failed email, and no registration expires before its email has gone out.
- The admin dashboard shows sent today, remaining quota, delayed jobs and failures.
- News posts never email, so they cannot use the quota.
- Undeliverable addresses are found only from send errors.

## Alternatives considered

- One shared daily counter. Derived from the plan's rationale: resend and reset could use the whole quota and starve verification.
- Failing jobs when the limit is reached. Not chosen: the plan holds jobs until the budget frees.
- Counting the 7-day expiry from registration. Named in the plan's review as a critical finding: queued mail could still be waiting when the registration expires.
