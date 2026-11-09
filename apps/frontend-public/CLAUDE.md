# frontend-public

Next.js app for the public site and the learner area, on `learn.<domain>` (port 3000). Shared rules: [root CLAUDE.md](../../CLAUDE.md), including the [UI review checklist](../../CLAUDE.md#ui-review-checklist). This file adds only what is specific to this app.

## Data path

- Public, cacheable pages (landing, course overview, resources, news, contact, certificate verification) are Server Components. They call the API on the internal network inside `'use cache'` functions tagged with `cacheTag`.
- Admin content changes reach this app through the secret-protected `/api/revalidate` Route Handler, reachable only on the internal network, which calls `revalidateTag`. Compare the secret in constant time, and keep Nginx from routing that path from outside.
- Signed-in pages check the session in a `server-only` data access layer (`verifySession()` wrapped in React `cache()`), never only in a layout. They prefetch their first data into TanStack Query and pass it on with `HydrationBoundary`.
- `proxy.ts` only does optimistic work: token refresh, redirect to sign-in when no session cookie exists, and the CSP nonce. Real authorisation is the API's.

## Rules

- No secrets in `NEXT_PUBLIC_*`. No third-party scripts on student pages.
- Images use `next/image` with the custom loader; the built-in Next.js image optimizer stays off. Fonts are self-hosted with `next/font`.
- Load the player chunk only on lesson pages.
- Budgets: first-load JavaScript at most 300 KB gzipped on public pages and 200 KB on learner pages (excluding the player).
- Phone layout is the primary one for learner screens: the sidebar becomes a bottom bar under `md`, and the lesson video is pinned on top.
