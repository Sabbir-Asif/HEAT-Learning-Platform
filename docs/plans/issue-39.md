# Issue 39: spike, ADR for Content-Security-Policy with nonces and hashes

Branch `spike/39-spike-adr-content-security`, pull request against `epic/e1-design-system-and-app-shells`. English only, no designs, no production header change.

## Approach

- Prototype: a separate throwaway Next.js app in `apps/frontend-public/spikes/csp`, with its own `proxy.ts`, a `'use cache'` page and a dynamic page. It builds into its own directory and adds no route, header or proxy to the real app, so nothing ships in a production build of frontend-public.
- Verification: a Vitest suite run against the built and started spike app (`pnpm --filter frontend-public test:csp`), chosen over Playwright because Playwright is not set up yet. It inspects headers and HTML and checks the policy against the served inline scripts. Browser-enforced behaviour (violation events, a blocked injected script) is not proven by it and the ADR says so.
- Write ADR 0019 from the template, status Proposed, and its README row.

## Steps

1. Write the policy builder test first, then the builder.
2. Build the prototype pages and `proxy.ts`.
3. Write the build-output and served-response tests.
4. Measure, then write ADR 0019 with only what was measured, and mark the rest unverified.
5. Run lint, format, typecheck, coverage and build; open the pull request.
