# 0008. Certificate PDFs from an HTML template

- Status: Accepted
- Date: 2026-11-07
- Plan: [D8, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

Names are entered in English, so any PDF approach would work. The certificate should look like the rest of the site and leave room for longer names later.

## Decision

- The worker renders an HTML template with Playwright Chromium. The design is a normal web template that matches the site.
- Each certificate gets a random, non-sequential number, a QR code linking to the verification page, and a stored SHA-256 of the file.
- Rendering is idempotent: one PDF per enrollment.

## Consequences

- The worker image includes Chromium.
- Chromium runs with networking off and an escaped template, so a certificate cannot reach internal services or inject markup.
- The certificate stores the name it was issued with.

## Alternatives considered

- A PDF library that lays out the page in code. Derived from the plan's rationale, not named in it: the plan notes any PDF approach works for English names, and picks HTML because the design stays a web template and Bangla stays possible.
