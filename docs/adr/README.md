# Architecture decision records

One file per decision, numbered in order (`0001-title.md`). Each record states the decision, why, what follows from it and the alternatives considered. Changes to an ADR always go through the owner.

Records 0001 to 0016 are the design decisions D1 to D16 in section 02 of the [project plan](../plan/heat-lms-project-plan.html#decisions). The frontend design spec ([frontend architecture](../superpowers/specs/2026-11-07-frontend-architecture-design.md)) adds detail to D9, D13, D15 and D16. To add a record, copy [0000-template.md](0000-template.md) and take the next free number. The Content Security Policy record is written by its own spike (#39) and takes the next number then.

| No.  | Decision                                                                                                    | Plan       | Status   |
| ---- | ----------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 0001 | [pnpm + Turborepo monorepo with shared contracts](0001-monorepo-with-shared-contracts.md)                   | D1         | Accepted |
| 0002 | [Modular monolith API, separate worker process](0002-modular-monolith-api-and-worker.md)                    | D2         | Accepted |
| 0003 | [First-party cookie sessions, two realms](0003-cookie-sessions-two-realms.md)                               | D3         | Accepted |
| 0004 | [Content lock with course revisions](0004-content-lock-with-course-revisions.md)                            | D4         | Accepted |
| 0005 | [Signed HLS delivered by Nginx, never proxied through Node](0005-signed-hls-delivered-by-nginx.md)          | D5         | Accepted |
| 0006 | [Watched-interval progress the server can trust](0006-watched-interval-progress.md)                         | D6         | Accepted |
| 0007 | [Transactional outbox for email and jobs](0007-transactional-outbox.md)                                     | D7         | Accepted |
| 0008 | [Certificate PDFs from an HTML template](0008-certificate-pdfs-from-html-template.md)                       | D8         | Accepted |
| 0009 | [Bangla and English interface from day one](0009-bangla-and-english-interface.md)                           | D9         | Accepted |
| 0010 | [Hooks guide, CI and branch protection enforce](0010-hooks-guide-ci-and-branch-protection-enforce.md)       | D10        | Accepted |
| 0011 | [Enrollment approval lifecycle](0011-enrollment-approval-lifecycle.md)                                      | D11        | Accepted |
| 0012 | [Pluggable, quota-aware email](0012-pluggable-quota-aware-email.md)                                         | D12        | Accepted |
| 0013 | [One component library, minimal CSS](0013-one-component-library-minimal-css.md)                             | D13        | Accepted |
| 0014 | [Insights from daily rollups, not live scans](0014-insights-from-daily-rollups.md)                          | D14        | Accepted |
| 0015 | [One data path per kind of page](0015-one-data-path-per-kind-of-page.md)                                    | D15        | Accepted |
| 0016 | [Images and files on local disk behind a storage interface](0016-local-disk-storage-behind-an-interface.md) | D16        | Accepted |
| 0017 | [Text captcha accessibility exception](0017-text-captcha-accessibility-exception.md)                        | Section 01 | Accepted |

Conventions for the whole repo: [CLAUDE.md](../../CLAUDE.md).
