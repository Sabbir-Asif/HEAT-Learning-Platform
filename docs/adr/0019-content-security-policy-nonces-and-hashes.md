# 0019. Content-Security-Policy with nonces for dynamic pages and hashes for cached pages

- Status: Proposed
- Date: 2026-11-09
- Plan: [D15 and section 08](../plan/heat-lms-project-plan.html#decisions)

## Context

The quality bar requires a strict CSP with nonces and no unsafe script sources. The public app serves two kinds of pages ([0015](0015-one-data-path-per-kind-of-page.md)): cached public pages built with `'use cache'`, and signed-in pages rendered per request. The admin app is all signed-in pages. `proxy.ts` is meant to create the nonce, and both apps render `ThemeProvider` from `@heat/ui` (next-themes) in the root layout, which injects an inline script and, on theme change, a `<style>` element.

A throwaway app in `apps/frontend-public/spikes/csp` (Next.js 16.4.5, Turbopack, a `proxy.ts` that builds the policy) measured what is possible. Nothing in it ships: it is not part of the production build of either app, and no production header changes with this record. The suite is `pnpm --filter frontend-public test:csp` (Vitest against built and started servers, chosen because Playwright is not set up yet). Browser behaviour was observed once by hand with headless Chrome and is not automated.

What was measured:

- With `cacheComponents` on, a `'use cache'` page stays static when `proxy.ts` runs on it (`x-nextjs-cache: HIT`, `s-maxage` set). The proxy adds a fresh nonce to the response header, but the cached HTML contains no nonce, so about ten inline scripts (RSC payload, bootstrap, theme script) and the external chunk tags have none. Under a `'nonce-...' 'strict-dynamic'` policy Chrome blocked every script and the page did not hydrate.
- With `cacheComponents` on, a page that reads `headers()` inside `Suspense` is partially prerendered. Its static shell, including the external script tags, has no nonce; only the streamed part does. A nonce policy would break that page too.
- With `cacheComponents` off, a page that reads `headers()` is fully dynamic. Every script carries the request nonce, the nonce differs per request, and the response is `private, no-cache, no-store`. The only bare inline script is the next-themes script.
- The next-themes inline script is byte-identical on both page kinds, so one sha256 hash covers it. Its two injected `<style>` texts are also constant, so two hashes cover them. No `nonce` prop on `ThemeProvider` is needed if these hashes are in the policy.
- For a cached page, a policy made of `'self'` plus the sha256 of every inline script found in the built HTML loaded with zero violations in Chrome, hydrated, and ran the theme script and `next/image`. This policy was produced by a stand-in proxy script, not by the build.
- Inline script hashes differ per page (the RSC payload holds the page content), so a hash policy must be generated per page from the build output, and regenerated whenever the page is revalidated, because a revalidated `'use cache'` page gets new payload text.
- `next/image` sets a `style` attribute (`color:transparent`). Without a rule for style attributes Chrome reports a violation.

## Decision

Proposed, for the owner to accept or change.

1. Two policies, chosen by page kind, never one policy for all.
   - Dynamic signed-in pages (frontend-public learner area, all of frontend-internal): rendered per request without Cache Components partial prerendering. `proxy.ts` makes a nonce per request, sets the policy on the response and the nonce on the request. Policy shape: `script-src 'self' 'nonce-<n>' 'sha256-<theme script>' 'strict-dynamic'`.
   - Cached public pages: no nonce. The policy lists the sha256 of every inline script of that page, generated from the built HTML, with `script-src 'self' <hashes>` and no `strict-dynamic`.
2. `script-src` never contains `unsafe-inline` or `unsafe-eval` in production. `unsafe-eval` is added only when `NODE_ENV` is development. A test fails if either appears in a production response.
3. Styles: `style-src-elem 'self'` plus the two next-themes style hashes, and `style-src-attr 'unsafe-inline'`. Style attributes cannot run script, the quality bar bans only unsafe script sources, and `next/image` needs the attribute rule. This is the one accepted relaxation. Apps still use no inline `style` of their own.
4. `ThemeProvider` keeps its current API. Its script and style are covered by hashes, so no `nonce` prop is required. A test compares the served script hash with the constant in the policy, so a next-themes upgrade that changes the script fails loudly.
5. Other directives, all same-origin: `default-src 'self'`, `img-src 'self' data: blob:`, `font-src 'self'`, `media-src 'self' blob:`, `worker-src 'self' blob:`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`.
   - Player (Video.js v10 on hls.js): `media-src 'self' blob:`, `worker-src 'self' blob:`, `connect-src 'self'` for signed `/hls` playlists, segments and `.vtt` captions served by Nginx, `img-src 'self' data: blob:` for posters. These values are a design target. They were not tested against a real player, playlist or worker. Unverified.
   - Sentry browser reporting: not installed. It will need its ingest host (or a same-origin tunnel route) in `connect-src`. Unverified; prefer the same-origin tunnel so `connect-src` stays `'self'`.
   - The admin app adds the same player values for course preview and no other host.
6. Rollout is report-only first, with both `Content-Security-Policy-Report-Only` and a `report-uri /csp-report` endpoint (a `report-to` group named `csp` is added with the Reporting-Endpoints header once the endpoint exists in the API). The prototype endpoint caps a body at 8 KB and answers 413 beyond it. Real endpoint: owned by the API, per-IP rate limit generous enough for a campus NAT, reports stored without IP address, user agent string beyond browser family, or full URL query, so no personal data is logged. The owner reviews violations weekly during report-only. Exit criteria to enforce: two weeks with zero unexplained violations on the learner and admin journeys, and the policy generation step passing in CI.
7. Cached pages must keep a cache-friendly response: the policy header for them is static per page and the CDN or Nginx may cache it with the page. Dynamic pages are `no-store`, so no nonce is shared between users.

## Consequences

- Cached pages need a build step that reads the built HTML, hashes inline scripts and emits a per-page policy, plus a way to serve it (Nginx map or route headers). The spike did not build this step. It is the main unsolved cost.
- Revalidating a cached page changes its inline script hashes. The policy must be regenerated at the same moment, or the page stops hydrating. The spike did not test revalidation. Risk: high until a design for it exists.
- The learner area needs a rendering mode where the shell is not prerendered. The spike got this by turning Cache Components off for that app; whether a single app can mix cached pages and fully dynamic pages with Cache Components on was not shown. If not, the learner area and the public pages may need to be separate apps or use different Next.js settings.
- The inline script injection test (an attacker script in the HTML being blocked and reported) was not run as a browser test. What was seen: nonce-less inline scripts were blocked by Chrome under the nonce policy on the cached page, which is the same mechanism. Back/forward cache and prefetch replay of a stale nonce were not tested. Fonts through `next/font` were not tested, because the spike does not load fonts; they are same-origin so `font-src 'self'` is expected to hold.
- Not in the spike: per-environment Nginx header handling, `Vary` behaviour behind a CDN, and the admin app itself.

## Alternatives considered

- All pages with a nonce: measured to fail on cached pages (no nonce in cached HTML) and on the static shell of partially prerendered pages. Not usable without making every page dynamic, which gives up caching.
- Hash only for all pages: works for cached pages, impractical for signed-in pages whose RSC payload differs per request.
- Subresource Integrity only: covers external script files, not inline scripts, so it cannot replace hashes. Derived from the rationale; not measured.
- `strict-dynamic` with hashes on cached pages: not needed because every script was covered by `'self'` and hashes, and it was not tested in that combination.
- `unsafe-inline` for scripts: rejected by the quality bar.

## Open points for the owner

- Proposed fallback if the per-page hash generation or the revalidation problem proves too costly: serve cached public pages with `script-src 'self'` plus the generated hashes only at deploy time, and shorten or remove time-based revalidation in favour of tag revalidation that triggers regeneration of the policy. If that is still too costly, accept `'unsafe-inline'` for scripts on public cached pages only, as a recorded exception, behind a ticket to remove it.
- Proposed: a follow-up ticket to build the hash generation step and to decide whether the learner area can share an app with cached pages.

## Note for production (added in the E1 final review; the status stays Proposed)

- Hashes in production must be generated at build time from the real build output, never typed in. The spike keeps the next-themes script hash and style hashes as constants only because it is throwaway. The spike suite fails if the served script hash or the injected transition style text drifts from those constants. The origin of the second style hash was not traced to a next-themes string, so it is unverified and the build step must derive every style hash from the output as well.
- The next-themes script is minified in the production build, so its hash differs from what the library renders in a plain Node process. Only the built HTML is a valid source for the hash.
- The report endpoint must bound memory before it parses anything: reject when `Content-Length` is above the cap, read the body as a stream, and stop reading when the cap is reached. The spike endpoint now does this (8 KB, 413 beyond it); the real endpoint in the API must keep the same behaviour.
