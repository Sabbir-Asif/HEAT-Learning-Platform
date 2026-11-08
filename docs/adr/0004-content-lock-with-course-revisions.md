# 0004. Content lock with course revisions

- Status: Accepted
- Date: 2026-11-07
- Plan: [D4, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

Students pass quizzes and earn certificates against specific content. Changing modules, answers or pass marks after students enrol would change what they were assessed on. The owner still wants wording fixes possible.

## Decision

- A course moves from `DRAFT` to `PUBLISHED`. Publishing is refused unless every module has a ready video and a quiz with at least one question.
- The lock is taken inside the first approval's transaction, so it cannot race an admin edit. From then on modules, videos, answer options, correct answers, quiz rules and pass marks are read-only.
- Wording fixes stay allowed, limited to text changes that keep the same structure: no added or removed images, links, sections or questions. Each one is stored as a before/after diff in the audit log.
- Description, thumbnail, tags and front-page order stay editable.
- Bigger changes go into a cloned draft revision. Enrollments are pinned to a revision at approval time.
- Shared video assets are reference-counted, so cleanup never deletes a video another revision uses.

## Consequences

- Every student's results stay meaningful for the revision they took.
- Authoring needs revision tooling: clone, publish and a read-only editor state with a note explaining why.
- Cleanup jobs must check reference counts before deleting video files.

## Alternatives considered

- Editing content in place after enrolment. Derived from the plan's rationale: it would change what students were assessed on.
- A full lock with no wording fixes. Not chosen: the owner decided wording fixes in module and question text stay allowed, with answers and rules locked.
- Taking the lock in a separate step after approval. Named in the plan's review as the lock race: an admin edit could slip in between. Replaced by locking inside the approval transaction.
