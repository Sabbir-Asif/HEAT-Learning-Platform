# 0003. First-party cookie sessions, two realms

- Status: Accepted
- Date: 2026-11-07
- Plan: [D3, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

Students and admins sign in on separate hosts (for example `learn.` and `admin.`) against one API. Students follow links from emails and expect to arrive signed in. A sibling subdomain must not be able to plant a CSRF token, and an admin account is a high-value target.

## Decision

- Nginx routes `/api` on both hosts to NestJS and blocks admin API paths on the student host.
- Cookies use the `__Host-` prefix.
  - The access cookie lasts 10 minutes and is `SameSite=Lax`, so links from emails arrive signed in.
  - The refresh cookie is `SameSite=Strict` and limited to the refresh path.
- The refresh token rotates and is stored hashed. Reuse is detected, with a 20-second grace window so parallel refreshes do not trigger it. The grace window lives in Redis.
- CSRF tokens are HMAC-bound to the session, so a sibling subdomain cannot plant one. Unsafe methods carry the token (double-submit, plan section 08).
- The access and refresh cookies are `HttpOnly` (frontend design spec section 10), so scripts cannot read the session or refresh tokens. The CSRF token is the one value the browser reads, because the client must send it back.
- Passwords use argon2id.
- Student and admin tokens carry different audiences, and the admin app has its own cookie name. Admin API routes reject student tokens even when the session is valid.
- Admin sign-in is by email and password only, with no second factor. The seeded super admin and every invited admin must change the password at first sign-in.
- Deactivating an admin revokes their sessions immediately. A break-glass command on the server restores super-admin access if the password is lost.

## Consequences

- Both apps share one cookie scheme behind one API.
- A removed student keeps video access for at most one cookie lifetime (10 minutes), enforced by the playback cookie in [0005](0005-signed-hls-delivered-by-nginx.md), see [0011](0011-enrollment-approval-lifecycle.md).
- The frontends refresh sessions in `proxy.ts` and in the generated client, see [0015](0015-one-data-path-per-kind-of-page.md).
- Admin sign-in rests on the password alone, so admin passwords are protected by the breached-password check, lockout and rate limits, and losing the super-admin password needs server access to recover.

## Alternatives considered

- Unprefixed cookies with a double-submit CSRF token that is not bound to the session. Named in the plan's review: a sibling subdomain could plant the CSRF cookie. Replaced by `__Host-` cookies and session-bound HMAC tokens. Double-submit stays, as in plan section 08.
- `SameSite=Strict` for the access cookie. Named in the plan's review: it broke links from emails. Replaced by a Lax access cookie and a Strict refresh cookie.
- Required admin two-factor (authenticator-app code with recovery codes). Named in the plan and dropped by the owner: ticket #49 was closed as not planned, and admin sign-in stays password only.

## Open points for the owner

The decision above repeats the plan. These points are conflicts or gaps in the plan itself.

1. `__Host-` and the refresh path. A `__Host-` cookie must be `Secure`, have no `Domain` and have `Path=/`. A browser rejects one that sets another path, so "`__Host-` prefix" and "refresh cookie limited to the refresh path" cannot both hold for the refresh cookie. Proposed, not decided: give the refresh cookie the `__Secure-` prefix, host-only, `Path` set to the refresh path, and keep `__Host-` for the others. The alternative is `__Host-` with `Path=/` and the refresh path enforced on the server.
2. CSRF token delivery. The plan says tokens are HMAC-bound to the session and uses double-submit, so the browser must be able to read the token, but it does not say how it is delivered. The frontend spec section 10 also lists `SameSite=Strict` for every cookie, which conflicts with the Lax access cookie in D3. Proposed, not decided: this record follows D3, and the auth ticket defines a readable CSRF cookie or a token endpoint and the exact cookie attributes.
3. Admin idle timeout. The frontend design spec proposes sessions that expire after 30 minutes idle, marked there as a builder's call and awaiting approval. The plan gives no value. Proposed, not decided: 30 minutes.
