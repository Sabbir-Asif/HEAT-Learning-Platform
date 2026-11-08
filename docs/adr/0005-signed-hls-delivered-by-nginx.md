# 0005. Signed HLS delivered by Nginx, never proxied through Node

- Status: Accepted
- Date: 2026-11-07
- Plan: [D5, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

Video is the heaviest load on a single VPS, and course videos must only reach students who may watch them.

## Decision

- The API checks access and issues a playback session. It sets a short-lived HMAC-signed cookie (`hls_sig`) scoped to `/hls/<videoId>/`. It lasts 10 minutes.
- Nginx (njs) verifies the signature on every playlist and segment without touching the database. It checks the HMAC, the expiry and the path prefix, against the normalised path (plan sections 07 and 08).
- The signature comparison is constant-time, and signing keys support rotation (plan section 08).
- Video bytes go from Nginx to the browser. They are never proxied through Node.
- Originals stay outside the web root.
- A Phase 1 spike proves this on the real VPS before anything else depends on it.

## Consequences

- Segment requests cost no database or Node time, so the VPS can serve many viewers.
- Access changes take effect when this cookie expires, at most 10 minutes later. [0003](0003-cookie-sessions-two-realms.md) and [0011](0011-enrollment-approval-lifecycle.md) rely on that bound.
- The player refreshes the playback session before the cookie expires (plan section 07).
- If the spike fails, the plan's fallback is a CDN or a separate video origin through the `assetKey` abstraction.

## Alternatives considered

- Streaming video through the API process. Named in the plan and rejected, in the decision title: "never proxied through Node".
- Checking the database for every segment. Derived, not named in the plan: Nginx verifies the signature "without touching the database".
