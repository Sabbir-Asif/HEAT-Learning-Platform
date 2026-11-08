# @heat/ui

The shared design system and the only place styles are written. Ships TypeScript source; the Next.js apps compile it through `transpilePackages`. Shared rules: [root CLAUDE.md](../../CLAUDE.md), including the [UI review checklist](../../CLAUDE.md#ui-review-checklist). This file adds only what is specific to the package.

## Rules

- Lint (`@heat/config/eslint/ui`) checks class conflicts and order here; arbitrary values and any Tailwind class are allowed here and nowhere else. Apps may only lay out. Details in the [README](../../README.md#quality-checks).
- Base is shadcn/ui on Base UI, themed only through CSS variables in `styles.css` (light and dark).
- `styles.css` is the single Tailwind theme and mirrors `docs/design/tokens.json`: change both together, `test/tokens.test.ts` and `test/contrast.test.ts` fail on drift or on a pair under its WCAG ratio. Per-theme values (colours, `--elevation-*`) live in `:root` and `.dark`; `@theme inline` maps them to utilities. Tailwind's default colours are removed, so only design colours exist.
- Fonts are self-hosted through `@fontsource-variable` imports in `styles.css`: Source Serif 4 for headings (`font-display`), Public Sans for body (`font-sans`), Latin only, `font-display: swap`.
- `ThemeProvider` wraps next-themes with the `dark` class and follows the device setting. Both app root layouts mount it. Storybook sets the same class through its toolbar decorator. The inline script and the style element injected on each theme change both need the CSP nonce once the CSP lands (#39); `ThemeProvider` then takes a `nonce` prop.
- Primitives live in `src/components`, one file each with its `*.stories.tsx`, and are exported from `src/index.ts`. Add one with `pnpm dlx shadcn@latest add <name>` from `packages/ui` (`components.json` is `base-nova`), then make it fit: relative imports instead of `@/` aliases (the apps compile this package without that alias), `cn` from `src/lib/utils.ts`, no comments, `"use client"` where Base UI or hooks are used, Prettier and `eslint --fix`.
- `test/primitives.test.ts` fails on a colour literal, a Tailwind default-palette colour, an arbitrary value holding a size, radius or colour, a comment, or an import outside Base UI, Lucide, Sonner, `class-variance-authority`, `clsx`, `tailwind-merge`, `next-themes` and React. Base UI state selectors (`data-[...]`, `in-data-[...]`) and variable references are allowed. Use the radius, colour and spacing tokens instead of `rounded-[...]` or `bg-black`; the overlay scrim is `bg-player/50`.
- `Sidebar` keeps no cookie. Open state is a prop or local state; persistence belongs to the app shell. `backdrop-blur` is for the header and sidebar only.
- Composites shared by both apps live here (page header, data table, form field, status badge, empty and error state, confirm dialog, stat card, file upload and the others in the design spec). Add one only when a ticket needs it in an app.
- `StatusBadge` holds the single mapping for enrollment, video and course states.
- Composites are in `src/composites`, one file and one story each, built only from the primitives. Overlays are drawers (`Sheet`), never modals. `ConfirmDialog` has two levels: a typed name (`confirmationName`) for irreversible deletes, a plain confirm for reversible actions.
- Heavy pieces sit behind subpath exports (`/data`, `/charts`, `/editor`, `/content`, `/player`, `/upload`, `/sortable`) so a page that does not use them does not load them.
- Author content (lesson text, news) is rendered only through `/content`, an allow-listed static renderer. Links are limited to `https:` and `mailto:`. Never use `dangerouslySetInnerHTML` with author content anywhere.
- Every component has a Storybook story with light and dark variants and passes the axe check. Keyboard behaviour of dialogs, menus and reordering has a test.
- Run stories with `pnpm --filter @heat/ui storybook` and their tests with `pnpm --filter @heat/ui test:stories`. Pin a story's theme with `globals`. Setup and the Playwright install are in the [README](../../README.md#storybook).
- No knowledge of the API, routes or session here: components take props and render.
