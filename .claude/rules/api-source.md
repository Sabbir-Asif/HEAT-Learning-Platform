---
paths:
  - "apps/api/src/**/*.ts"
---

# API source

- Every route has an explicit guard. Deny by default; the unguarded-route test must stay green.
- Errors use the stable codes from `@heat/contracts`.
- Logs are structured, carry the request id and never contain personal data.
- No `any`, no comments. Unsafe methods require the CSRF double-submit check.
- Rate limits key on account or email plus IP, with generous per-IP ceilings.
