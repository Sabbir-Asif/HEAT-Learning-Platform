# 0017. Text captcha accessibility exception

- Status: Accepted
- Date: 2026-11-07
- Plan: [Section 01 Requirements, captcha](../plan/heat-lms-project-plan.html#understanding) and [section 14 Adversarial review](../plan/heat-lms-project-plan.html#review)

## Context

Enrollment, resend-verification and forgot-password are protected by a backend-generated captcha: a distorted SVG with letters and digits, the answer stored hashed in Redis with a 5-minute TTL, single use, 3 tries, and no third-party service. The plan's risk table notes that screen-reader users cannot pass a text captcha. That fails WCAG 2.2 criterion 1.1.1 (Non-text Content), and the platform targets WCAG 2.2 AA. The plan's review rated this a high-severity finding.

## Decision

The owner chose to keep the text captcha (plan section 01, and the answers in section 03: "Text captcha only, recorded as an accessibility exception"). This record is that exception to WCAG 2.2 AA, criterion 1.1.1.

Mitigation, as the plan states it: the form shows a support contact for students who cannot read the captcha.

## Consequences

- A student who cannot read the captcha has the support contact as the only route the plan provides.
- The shared `CaptchaField` component carries the image, a refresh button, the input and the support contact (frontend design spec), so every form that uses the captcha shows the mitigation.

## Alternatives considered

- A captcha with an accessible alternative, such as audio, or a third-party service. Derived, not named in the plan. The plan does not record that this was declined: it records that the owner kept the text captcha with a support contact, and it requires no third-party service.
- No captcha. Derived, not named in the plan. Not chosen: the plan requires the captcha on the forms above, and [0012](0012-pluggable-quota-aware-email.md) requires it on resend-verification and forgot-password to protect the email quota.

## Open points for the owner

The plan states the mitigation in one line. These gaps are not covered by it. Each resolution is Proposed, not decided.

1. Text alternative for the image. Criterion 1.1.1 asks that a CAPTCHA image have a text alternative that identifies its purpose. Proposed: the image has an accessible name that says it is a security check and points to the support contact, and the input has an associated label.
2. How support unblocks a student. The form cannot be submitted without the captcha, so a contact alone does not complete enrollment, resend-verification or forgot-password. Proposed: define what support does, and require that any bypass needs an authenticated staff member, never resets a password or changes an email without the verified-email check, is rate-limited and is audit-logged.
3. Who answers the contact. The plan names no owner, channel or response time. Proposed: name a role and a response time, make the contact reachable without the captcha or a login, and keep it out of the Gmail quota budget of 0012.
4. WCAG 3.3.8. Criterion 3.3.8 Accessible Authentication (Minimum) may also apply, because transcribing distorted text is a cognitive function test and forgot-password is part of authentication. It would also affect low-vision, dyslexic and cognitive-disability users, not only screen-reader users. Proposed: list 3.3.8 in this exception once the owner confirms.
5. Review trigger. The plan sets no point to revisit the exception. Proposed: revisit it when a student reports being blocked and before the public launch, and say in the accessibility statement that full WCAG 2.2 AA conformance is not claimed while it stands.
