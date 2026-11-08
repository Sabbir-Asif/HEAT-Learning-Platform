# @heat/ui

The shared design system and the only place styles are written. Ships TypeScript source; the Next.js apps compile it through `transpilePackages`. Shared rules: [root CLAUDE.md](../../CLAUDE.md), including the [UI review checklist](../../CLAUDE.md#ui-review-checklist). This file adds only what is specific to the package.

## Rules

- Lint (`@heat/config/eslint/ui`) checks class conflicts and order here; arbitrary values and any Tailwind class are allowed here and nowhere else. Apps may only lay out. Details in the [README](../../README.md#quality-checks).
- Base is shadcn/ui on Base UI, themed only through CSS variables in `styles.css` (light and dark).
- `styles.css` is the single Tailwind theme and mirrors `docs/design/tokens.json`: change both together, `test/tokens.test.ts` and `test/contrast.test.ts` fail on drift or on a pair under its WCAG ratio. Per-theme values (colours, `--elevation-*`) live in `:root` and `.dark`; `@theme inline` maps them to utilities. Tailwind's default colours are removed, so only design colours exist.
- Fonts are self-hosted through `@fontsource-variable` imports in `styles.css`: Source Serif 4 for headings (`font-display`), Public Sans for body (`font-sans`), Latin only, `font-display: swap`.
- `ThemeProvider` wraps next-themes with the `dark` class and follows the device setting. Both app root layouts mount it. Storybook sets the same class through its toolbar decorator. The inline script needs a nonce once the CSP lands (#39).
- Composites shared by both apps live here (page header, data table, form field, status badge, empty and error state, confirm dialog, stat card, file upload and the others in the design spec). Add one only when a ticket needs it in an app.
- `StatusBadge` holds the single mapping for enrollment, video and course states.
- Heavy pieces sit behind subpath exports (`/data`, `/charts`, `/editor`, `/content`, `/player`, `/upload`, `/sortable`) so a page that does not use them does not load them.
- Author content (lesson text, news) is rendered only through `/content`, an allow-listed static renderer. Links are limited to `https:` and `mailto:`. Never use `dangerouslySetInnerHTML` with author content anywhere.
- Every component has a Storybook story with light and dark variants and passes the axe check. Keyboard behaviour of dialogs, menus and reordering has a test.
- Run stories with `pnpm --filter @heat/ui storybook` and their tests with `pnpm --filter @heat/ui test:stories`. Pin a story's theme with `globals`. Setup and the Playwright install are in the [README](../../README.md#storybook).
- No knowledge of the API, routes or session here: components take props and render.
