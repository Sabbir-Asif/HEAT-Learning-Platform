# 0011. Enrollment approval lifecycle

- Status: Accepted
- Date: 2026-11-07
- Plan: [D11, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

Admins must approve every student before they start. The lifecycle has to handle rejection, removal, expiry and people enrolling in several courses, without deleting a real student's account, leaking who has enrolled, or letting someone squat an email address.

## Decision

- Status moves `PENDING_VERIFICATION` to `PENDING_APPROVAL` to `APPROVED` to `COMPLETED`, or to `REJECTED`, `EXPIRED` or `REMOVED`.
- Content endpoints and playback sessions allow `APPROVED` and `COMPLETED`. A removed student loses video access within one cookie lifetime (10 minutes).
- Removal is possible from either state, and reinstatement restores the state the student had.
- Rejection soft-deletes the account only when no other approved or completed enrollment exists.
- Email jobs store a copy of the recipient address, so the rejection email still goes out after the account is hidden.
- A new registration for an email that only has an unverified account replaces that account.
- Verifying an email signs out every session created before verification.
- Registering an email that already has an account shows the normal success message and sends that address a "you already have an account" email.

## Consequences

- The form never reveals who has enrolled, and nobody can squat or pre-hijack an account.
- Every decision is audit-logged and carries a reason shown to the student.
- Approval pins the enrollment to the current course revision, locks the course and unlocks module 1 in one transaction, see [0004](0004-content-lock-with-course-revisions.md).
- Unverified registrations expire after 7 days, counted as in [0012](0012-pluggable-quota-aware-email.md).

## Alternatives considered

- Soft-deleting the account on every rejection. Named in the plan's review as a critical finding: rejecting a second-course request would delete an existing student.
- Sending the rejection email from the account's current address after deletion. Named in the review: emails to hidden accounts could fail. Replaced by storing the recipient on the job.
- Answering "email already registered" on the form. Named in the review: it reveals who has enrolled. Replaced by the generic success message.
