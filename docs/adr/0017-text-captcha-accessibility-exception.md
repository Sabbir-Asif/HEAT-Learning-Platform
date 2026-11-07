# 0017. Text captcha accessibility exception

- Status: Accepted
- Date: 2026-11-07
- Plan: [Section 01 Requirements, captcha](../plan/heat-lms-project-plan.html#understanding) and [section 14 Adversarial review](../plan/heat-lms-project-plan.html#review)

## Context

Enrollment, resend-verification and forgot-password are protected by a backend-generated captcha: a distorted SVG with letters and digits, the answer stored hashed in Redis with a 5-minute TTL, single use, 3 tries, and no third-party service. A text captcha is non-text content that screen-reader users cannot perceive. That fails WCAG 2.2 criterion 1.1.1 (Non-text Content), and the platform targets WCAG 2.2 AA. The plan's review rated this a high-severity finding.

## Decision

The owner chose to keep the text captcha. This record is the accepted exception to WCAG 2.2 AA, criterion 1.1.1.

Mitigation: the form shows a support contact for students who cannot read the captcha, so affected students can be helped.

## Consequences

- A student who cannot read the captcha cannot finish the form alone and must use the support contact.
- Someone must answer those contacts.
- The shared `CaptchaField` component carries the image, a refresh button, the input and the support contact, so every form that uses the captcha shows the mitigation.

## Alternatives considered

- A captcha that meets criterion 1.1.1, such as one with an audio alternative or a third-party service. Derived from the finding, not named in the plan. Not chosen: the owner decided on a text captcha only, and the plan requires no third-party service.
- No captcha. Not chosen: the captcha protects enrollment, resend-verification and forgot-password against abuse, and [0012](0012-pluggable-quota-aware-email.md) requires it on resend-verification and forgot-password to protect the email quota.
