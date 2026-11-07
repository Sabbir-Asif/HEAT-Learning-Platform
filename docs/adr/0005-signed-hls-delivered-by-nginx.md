# 0005. Signed HLS delivered by Nginx, never proxied through Node

- Status: Accepted
- Date: 2026-11-07
- Plan: [D5, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

Video is the heaviest load on a single VPS, and course videos must only reach students who may watch them.

## Decision

- The API checks access and issues a playback session. It sets a short-lived HMAC-signed cookie scoped to `/hls/<videoId>/`.
- Nginx (njs) verifies the signature on every playlist and segment without touching the database.
- Video bytes go from Nginx to the browser. They are never proxied through Node.
- Originals stay outside the web root.
- A Phase 1 spike proves this on the real VPS before anything else depends on it.

## Consequences

- Segment requests cost no database or Node time, so the VPS can serve many viewers.
- Access changes take effect when the cookie expires, see [0003](0003-cookie-sessions-two-realms.md) and [0011](0011-enrollment-approval-lifecycle.md).
- The player must refresh the cookie before it expires, see [0006](0006-watched-interval-progress.md) for the progress side.
- If the spike fails, the plan's fallback is a CDN or a separate video origin through the `assetKey` abstraction.

## Alternatives considered

- Streaming video through the API process. Named in the plan and rejected, in the decision title: "never proxied through Node".
- Checking the database for every segment. Derived from the plan's rationale: Nginx verifies the signature "without touching the database".
