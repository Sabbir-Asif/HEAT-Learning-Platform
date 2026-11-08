# frontend-internal

Next.js admin console on `admin.<domain>` (port 3001). Shared rules: [root CLAUDE.md](../../CLAUDE.md), including the [UI review checklist](../../CLAUDE.md#ui-review-checklist). This file adds only what is specific to this app. The data path is the one in [frontend-public](../frontend-public/CLAUDE.md#data-path), without the public cached pages.

## Rules

- English only, no locale segment.
- Send `X-Robots-Tag: noindex`. Never link to this app from the public site.
- Hide role-restricted pages in the navigation, and rely on the API to enforce them. Admin sessions expire after 30 minutes idle.
- Every list uses the shared `DataTable` with server-side pagination, sorting and filters. Keep that state in the URL with nuqs, using the parsers shared through `@heat/contracts`. Under `md` the table becomes a card list.
- Create and edit use the same form component, built on `FormField` and React Hook Form, with an unsaved-changes guard.
- Destructive actions go behind `ConfirmDialog` and name the item.
- When a course is locked, locked fields render read-only with a note that says why. Wording-fix fields say that changes are logged.
- Rich text is edited with `RichTextEditor` only.
- Reordering uses `SortableList`, which always offers Move up and Move down as well as dragging.
- Design and test `/` and `/enrollments` at phone width (card list, filters in a sheet, plain approve and reject buttons, bulk select). Other screens are laptop-first and stay usable.
- Course preview renders inside this app from the same `@heat/ui` building blocks as the lesson page. The learner page compositions stay in `frontend-public`.
