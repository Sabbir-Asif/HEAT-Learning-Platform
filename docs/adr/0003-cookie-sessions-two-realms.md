# 0003. First-party cookie sessions, two realms

- Status: Accepted
- Date: 2026-11-07
- Plan: [D3, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

Students and admins sign in on separate hosts (for example `learn.` and `admin.`) against one API. Students follow links from emails and expect to arrive signed in. A sibling subdomain must not be able to plant a CSRF token, and an admin account is a high-value target.

## Decision

- Nginx routes `/api` on both hosts to NestJS and blocks admin API paths on the student host.
- Cookies use the `__Host-` prefix.
  - The access cookie lasts 10 minutes (the 10-minute access cookie) and is `SameSite=Lax`, so links from emails arrive signed in.
  - The refresh cookie is `SameSite=Strict` and limited to the refresh path.
- The refresh token rotates and is stored hashed. Reuse is detected, with a 20-second grace window so parallel refreshes do not trigger it. The grace window lives in Redis.
- CSRF tokens are HMAC-bound to the session.
- Passwords use argon2id.
- Student and admin tokens carry different audiences, and the admin app has its own cookie name. Admin API routes reject student tokens even when the session is valid.
- Every admin, including the super admin, must enter an authenticator-app code (TOTP) at sign-in, and gets recovery codes. Admin TOTP is required, not optional.
- Deactivating an admin revokes their sessions immediately. A break-glass command on the server restores super-admin access if the authenticator is lost.
- Admin sessions expire after 30 minutes idle (set in the frontend design spec).

## Consequences

- No tokens are readable by browser scripts, and the cookie scheme works for both apps behind one API.
- A removed student keeps video access for at most one access-cookie lifetime (10 minutes), see [0011](0011-enrollment-approval-lifecycle.md).
- The frontends refresh sessions in `proxy.ts` and in the generated client, see [0015](0015-one-data-path-per-kind-of-page.md).
- Admin sign-in has more steps, and losing the authenticator needs server access to recover.

## Alternatives considered

- Unprefixed cookies with a plain double-submit CSRF token. Named in the plan's review: a sibling subdomain could plant the CSRF cookie. Replaced by `__Host-` cookies and session-bound HMAC tokens.
- `SameSite=Strict` for the access cookie. Named in the plan's review: it broke links from emails. Replaced by a Lax access cookie and a Strict refresh cookie.
- Optional admin two-factor. Not chosen: the owner requires an authenticator-app code for every admin.
