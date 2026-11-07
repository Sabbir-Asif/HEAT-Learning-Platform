# @heat/ui

The shared design system and the only place styles are written. Ships TypeScript source; the Next.js apps compile it through `transpilePackages`. Shared rules: [root CLAUDE.md](../../CLAUDE.md), including the [UI review checklist](../../CLAUDE.md#ui-review-checklist). This file adds only what is specific to the package.

## Rules

- Base is shadcn/ui on Base UI, themed only through CSS variables in `styles.css` (light and dark). Components use tokens, never raw values.
- Composites shared by both apps live here (page header, data table, form field, status badge, empty and error state, confirm dialog, stat card, file upload and the others in the design spec). Add one only when a ticket needs it in an app.
- `StatusBadge` holds the single mapping for enrollment, video and course states.
- Heavy pieces sit behind subpath exports (`/data`, `/charts`, `/editor`, `/content`, `/player`, `/upload`, `/sortable`) so a page that does not use them does not load them.
- `/content` renders author JSON through an allow-listed static renderer. Never use `dangerouslySetInnerHTML` with author content anywhere.
- Every component has a Storybook story with light, dark, Bangla and English variants and passes the axe check. Keyboard behaviour of dialogs, menus and reordering has a test.
- One self-hosted font family with full Bangla and Latin coverage.
- No knowledge of the API, routes or session here: components take props and render.
