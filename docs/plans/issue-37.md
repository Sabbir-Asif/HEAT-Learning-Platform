# Issue 37: app shells for both frontends

One pull request covering 37a, 37b and 37c. English only, no locale routing. No new designs: shells copy the approved frames in `docs/design/exports/`.

## Approach

- `@heat/ui/shell` (subpath export, kept out of the root bundle) holds the building blocks: skip link, main landmark, header, frosted sidebar with grouped navigation, bottom bar, public header with sheet navigation, public footer, theme switch, user menu, notifications link, themed logo. Pure navigation logic (`isActivePath`, `findActiveHref`, `visibleGroups`, `capCount`) lives in `shell/nav.ts` and is unit tested.
- Components never import `next/link`. Apps pass a `link` component from a thin client composition file in `src/shell/`, together with `usePathname()`.
- Dark logos swap with CSS (`dark:hidden`), so there is no flash. The theme switch shows both icons and lets the `dark` class pick, so there is no hydration mismatch.
- The learner bottom bar is a sticky last child of the page column, so it never covers content; it pads for the iOS safe area.
- `frontend-public` route groups: `(public)`, `(auth)`, `(learner)`, each with a layout, `loading.tsx` and `error.tsx`, and a placeholder page for every route in spec section 6.1 plus `/courses`, `/learn`, `/verify`, `/privacy`, `/terms`, `/accessibility`.
- `frontend-internal` has one admin shell (grouped sidebar, breadcrumbs, `PageHeader`, mobile sheet) and placeholders for spec section 7.1. `X-Robots-Tag: noindex` is set in `headers()` for `/:path*`.
- Each app exports `src/routes/manifest.ts` (`path`, `kind` of `public`, `learner`, `admin` or `auth`) for the Playwright and Lighthouse tickets (#38, #40). A test checks that every manifest path has a page file.

## Tests first

1. `shell/nav.ts`: active item (nested routes, root, longest match), hidden items, count cap.
2. Stories with the axe check for each shell block, light and dark; keyboard play test for the theme switch.
3. App tests: navigation config, breadcrumbs, manifest against the file system, loading and error states, `next.config` noindex headers.
4. Browser check at 360, 390 and 1440 px, light and dark, on `next build` output.

## Out of scope

Playwright and Lighthouse (#38, #40), notification behaviour, session checks, page content.
