# HEAT LMS — Frontend Architecture Design

Date: 2026-11-07 · Status: revised after adversarial review, awaiting approval · Companion to the project plan (`docs/plan/heat-lms-project-plan.html`, decisions D1–D16 and section 14, Adversarial review)

## 1. Intent

Two Next.js apps sit in front of one NestJS API:

- **`frontend-public`** — everything a visitor or student touches: public pages, the enrollment request, sign-in and account recovery, the learner area (dashboard, lessons, video, quizzes, certificates, notifications, profile).
- **`frontend-internal`** — everything an admin touches: approvals, students, insights, course authoring, video library, academic directory, content pages, admin users, audit log.

The owner's priorities, in their words and choices:

- Production grade, secure, high quality, consistent across many AI-written tickets.
- **Reusable UI components shared across both apps, very little CSS, a professional modern look, no filler components.**
- Students use phones and laptops equally, often on **slow mobile data**.

### Goals
- Fast and light on slow mobile networks, on both phone and laptop layouts.
- One component library and one way of fetching data, so every screen looks and behaves the same.
- Validation, types and API calls generated or shared, never hand-copied between frontend and backend.
- Accessible (WCAG 2.2 AA) English student experience.

### Non-goals (v1)
- Installable app / PWA, offline video, push notifications.
- Real-time sockets; polling is enough at this scale.

### Anti-goals (a failure even if it works)
- App-level CSS files, one-off styles, or decorative components that do not serve the screen's task.
- Two different ways to call the API, or validation rules that differ between form and server.
- Course content or video bytes reachable without the API's authorization.
- A student losing quiz answers or watch progress because the connection dropped.

## 2. Decisions taken with the owner (2026-11-07)

| Topic | Decision |
|---|---|
| Student devices | Phone and laptop equally — both layouts get equal design and test effort |
| Network | Built for slow mobile data |
| Dark mode | Both apps, following the device, with a manual switch |
| Student app URLs | No language prefix: `/`, `/courses/...`, `/learn/...` |
| Admin devices | Laptop-first; approvals and the dashboard must work well on a phone |
| Admin language | English only |
| Rich text | Simple Word-like editor (headings, bold, italic, lists, links, images, quotes) |
| Notifications | In-app bell plus email |
| Learner layout | Separate signed-in layout with a sidebar (as in the demo); bottom bar on phones |
| Quiz | One question per screen, progress bar, review screen before submit |
| Install as app | No — website only |
| Emails for events | Request approved / rejected, removed / reinstated, certificate ready. News posts are bell-only |
| Captions | Optional: admins may upload WebVTT files per video (any language); the player shows a captions menu when any exist |
| Resources | Public — anyone can open and download |
| Quiz question types | Single choice only in v1 |
| Design gate | The owner approves the Open Pencil designs and theme before any screen work starts; setup and backend work continue meanwhile |

## 3. Technology baseline (verified against npm on 2026-11-07)

| Concern | Choice | Version line |
|---|---|---|
| Framework | Next.js App Router, Turbopack, `output: 'standalone'` | 16.4.x (pin latest security patch) |
| React | React + React Compiler (`reactCompiler: true`) | 19.3 |
| Caching | Cache Components (`cacheComponents: true`), `'use cache'`, `cacheTag`, `revalidateTag(tag, 'max')` | — |
| Request gate | `proxy.ts` (Node runtime; replaces middleware) | — |
| UI kit | shadcn/ui on **Base UI** (`base-nova`), monorepo mode | CLI 4.x |
| Styling | Tailwind CSS v4, CSS-first tokens | 4.3 |
| Server state | TanStack Query | 5.x |
| API client | **orval**-generated TanStack Query hooks + Zod from the NestJS OpenAPI spec | 8.x |
| Forms | React Hook Form + `@hookform/resolvers` + shadcn `Field` | RHF 7.9x |
| Validation | Zod 4, shared through `@heat/contracts` (also used by `nestjs-zod`) | 4.x |
| URL state | nuqs (tables, filters, tabs) | 2.x |
| Tables | TanStack Table **v9** (do not copy v8 examples) | 9.x |
| Charts | shadcn chart on Recharts v3 | 3.x |
| Video | **Video.js v10** (`@videojs/react` + `@videojs/hlsjs-video`, shadcn registry skin) on hls.js | 10.3 / 1.7 |
| Rich text | **Tiptap v3**, stored as ProseMirror JSON; public rendering via `@tiptap/static-renderer` | 3.x |
| Drag & drop | `@dnd-kit/react` behind a `SortableList` wrapper (pin exact; pre-1.0) | 0.5.x |
| Upload | Uppy 6 headless hooks + `@uppy/tus` | 6.x |
| Toasts / dates / icons | sonner, date-fns 4 + `@date-fns/tz`, lucide-react | — |
| Theme switch | next-themes | 0.4.x |
| Component workbench | Storybook 10 + a11y addon + Vitest addon | 10.x |
| E2E / a11y / visual | Playwright + `@axe-core/playwright` + `toHaveScreenshot()` in a pinned Docker image | 1.65 |
| Errors / vitals | Sentry for Next.js, Web Vitals reporting | — |

Replaced from the earlier plan: Zustand is dropped (URL state + TanStack Query + local component state cover every case); Vidstack is not used (superseded by Video.js v10 and in security-only maintenance).

## 4. Monorepo layout

```
apps/
  frontend-public/      # learn.<domain>
  frontend-internal/    # admin.<domain>
  api/  worker/
packages/
  ui/                   # @heat/ui — the only place styles are written
  contracts/            # @heat/contracts — Zod schemas, enums, error codes
  api-client/           # @heat/api-client — orval output + fetch mutator + server fetcher
  config/               # eslint, tsconfig, vitest presets
```

`@heat/ui` uses subpath exports so heavy pieces never reach pages that do not use them:

| Import | Contents | Used by |
|---|---|---|
| `@heat/ui` | primitives + light composites | both |
| `@heat/ui/styles.css` | Tailwind theme tokens (light/dark), base layer | both |
| `@heat/ui/data` | DataTable, FilterBar, Pagination (TanStack Table) | internal (+ public certificates list if needed) |
| `@heat/ui/charts` | ChartCard, chart presets | internal |
| `@heat/ui/editor` | RichTextEditor (Tiptap) | internal |
| `@heat/ui/content` | RichTextRenderer (server, static renderer, allow-listed nodes) | both |
| `@heat/ui/player` | VideoPlayer (Video.js v10), lazy-loaded | public (lesson), internal (preview) |
| `@heat/ui/upload` | FileUpload / VideoUpload (Uppy + tus) | internal, public (avatar) |
| `@heat/ui/sortable` | SortableList (dnd-kit, plus Move up/down actions) | internal |

Turborepo notes: each app's CSS entry imports `@heat/ui/styles.css` and declares `@source "../../../packages/ui/src"`; `transpilePackages` lists the internal packages; a single React version across the workspace; `NEXT_PUBLIC_*` declared in `turbo.json`; images built with `turbo prune <app> --docker`; `outputFileTracingRoot` set to the repo root.

## 5. How the apps talk to the API

One rule set for both apps:

1. **Public, cacheable pages** (landing, course overview, resources, news, contact, certificate verification) are Server Components that call the API on the internal Docker network (`http://api:3000`) inside `'use cache'` functions tagged with `cacheTag`. Marketing pages use `ensureStatic` where possible. When admins change content, the API calls a secret-protected Route Handler in `frontend-public` (`/api/revalidate`, reachable only on the internal network) that runs `revalidateTag(tag, 'max')`.
2. **Signed-in pages** check the session in a **Data Access Layer** (`server-only`, `verifySession()` wrapped in React `cache()`), which calls the API's `/me` with the forwarded cookies. Auth checks live in the DAL and in each page's data calls — never only in a layout. The page prefetches its first data into TanStack Query and hands it over with `HydrationBoundary`.
3. **Everything interactive** (forms, quizzes, progress, tables, uploads) runs in the browser through the orval-generated hooks calling same-origin `/api`, which Nginx routes to NestJS. **No Server Actions** are used for business mutations: the API stays the single authority and there is one auth and CSRF path.
4. **Token refresh.**
   - `proxy.ts` reads the access cookie's expiry without verifying it; if it is missing or expires within 60 s and a refresh cookie exists, it calls the API's refresh endpoint, sets the new cookies on the response, and forwards them on the request so the same render uses them.
   - If a server render still gets 401, it redirects to `/auth/refresh?next=…` (Route Handler) which refreshes or sends the user to sign-in.
   - In the browser, the orval mutator performs one shared refresh on 401 and retries once.
   - **Backend requirement:** refresh-token rotation gets a 20-second grace window in Redis so parallel refreshes do not trigger reuse detection and log the user out.
5. **Cookies and CSRF.** Cookies use the `__Host-` prefix. The access cookie (10 minutes) is `SameSite=Lax` so links from emails arrive signed in; the refresh cookie is `SameSite=Strict` and limited to the refresh path. The mutator sends a CSRF token that is HMAC-bound to the session on every unsafe request, so a sibling subdomain cannot plant a valid one. Nginx blocks admin API paths on the student host.
6. **Errors.** The API's stable error codes (from `@heat/contracts`) map to messages; form-level errors map to fields by path.

`proxy.ts` only does optimistic work (refresh, redirect to sign-in when no session cookie exists). Real authorization is always the API's.

## 6. `frontend-public`

### 6.1 Routes

The interface is English only, so routes carry no language prefix.

| Area | Route | Rendering |
|---|---|---|
| Public | `/` landing (overview, front-page courses and modules) | cached |
| | `/about`, `/courses/[slug]` (overview, module list, enroll button) | cached |
| | `/resources`, `/news`, `/news/[slug]`, `/contact` | cached |
| | `/verify/[certificateNumber]` | cached only for numbers that exist; unknown numbers are never cached; revoking a certificate purges its entry |
| Auth | `/enroll` (two-step wizard, `?course=`), `/sign-in`, `/forgot-password`, `/reset-password/[token]`, `/verify-email/[token]` | dynamic |
| Learner | `/dashboard` | DAL + prefetch |
| | `/awaiting-approval` (status, resend verification, profile link) | DAL |
| | `/learn/[course]` (course home, module list with lock states) | DAL + prefetch |
| | `/learn/[course]/[module]` (video, lesson text, objectives) | DAL + prefetch, player lazy |
| | `/learn/[course]/[module]/quiz`, `…/quiz/result/[attempt]` | DAL + client |
| | `/certificates`, `/notifications`, `/profile` | DAL + prefetch |

Enrollment is checked **per course**, not per student (my call, following the plan's many-courses model):

- `GET /me` returns the user and a list of enrollments (course, status, reason). The DAL exposes `requireCourseAccess(courseSlug)`, used by every `/learn/[course]/…` page and by the API on every content call.
- `APPROVED` and `COMPLETED` both give access. A completed student can rewatch videos and review lessons; quizzes they passed show the result rather than a new attempt (my call).
- `PENDING_VERIFICATION` / `PENDING_APPROVAL` → that course shows its pending status; a student with no accessible course lands on `/awaiting-approval` after sign-in.
- `REMOVED` (from approved or completed) → the course shows the reason and no content; reinstatement restores the earlier state. `REJECTED` / `EXPIRED` accounts are soft-deleted only when they have no other approved or completed enrollment, and then cannot sign in; they learn the reason by email.
- **Further courses**: a signed-in, verified student sees "Request to enroll" on `/courses/[slug]`; it creates a `PENDING_APPROVAL` enrollment directly (email is already verified) and the course appears on the dashboard as pending (my call).
- Dashboard and My Learning group courses by status: in progress, completed, pending, removed.
- **Profile**: picture can always change. Name, university, faculty, department and session are read-only after the first approval; a "Request a change" form sends the change to admins. Changing the password needs the current password and a 6-digit code emailed to the student.

### 6.2 Layouts
- **Public layout**: header with HEAT logo and University of Dhaka crest, primary nav (Home, About, Training Modules, Resources, News, Contact), language switch, theme switch, Sign in / Enroll; footer with the three partner logos.
- **Learner layout**: sidebar (Dashboard, My Learning, Certificates, Resources, Profile) with a top bar (notifications bell, language, theme, user menu). Under the `md` breakpoint the sidebar becomes a 5-item bottom bar.
- **Lesson page**: laptop — video and lesson text in the main column, module/lesson list and objectives in a side panel; phone — video pinned on top, tabs for Lesson / Objectives / Modules below.

### 6.3 Key flows
- **Enrollment wizard.** One route, two steps, per-step Zod schemas from `@heat/contracts`. Cascading selects load from cached lookup endpoints. The captcha component shows the server image, a refresh button, the input and a support contact (the text captcha is an owner-accepted accessibility exception). Step-1 values persist in `sessionStorage` (never the password). On submit: success screen telling the student to verify their email.
- **Player.** `@heat/ui/player` wraps Video.js v10:
  - Auto quality by default and a manual quality menu.
  - Data saver: when `navigator.connection.saveData` is on or the connection is 2G/3G, auto quality is capped at 480p; otherwise at 720p. 1080p is always available manually. The student's choice is remembered.
  - Bounded buffer (about 20 s ahead, 30 s behind) and a saved bandwidth estimate so the next video starts at a sensible quality.
  - Resume from the API's saved position.
  - Signed-cookie refresh at about 60% of the cookie's lifetime and on tab focus or reconnect. On a 403, one shared refresh, then playback resumes from the current time.
  - English labels, keyboard shortcuts. Captions menu appears only when the video has caption files; captions are styled with `::cue`.
  - On iPhone, fullscreen uses the system player; the layout accounts for that.
- **Progress.** Every 15 s and on pause, seek, tab hide or end, the player sends the newly watched ranges (from `video.played`) with a sequence number; on page hide it uses `sendBeacon`. Unsent heartbeats are kept in memory and `localStorage` and retried on reconnect. The quiz button opens when the API reports 80% coverage. The server caps accepted ranges by the time elapsed since the playback session started multiplied by the top playback speed, so retried batches are accepted only within that budget.
- **Quiz.** Single-choice questions (radio group), one question per screen, progress bar, Previous/Next, a review screen listing unanswered questions, then submit. Answers are saved locally while in progress so a dropped connection does not lose them. Submission carries an idempotency key. The result screen shows score, pass or fail, explanations after a pass, and a countdown when a waiting time applies.
- **Notifications.** Bell with unread count; the list polls every 60 s while the tab is visible; mark one or all as read. Bell events: request approved / rejected, removed / reinstated, certificate ready, new news post. Only the first three also send email; news posts never email, so they cannot consume the Gmail quota. No email preference screen is needed in v1.
- **Certificates.** Card per certificate with download and a copyable verification link.

### 6.4 Slow-network budget
- First-load JavaScript for public pages ≤ 300 KB gzipped; learner pages ≤ 200 KB excluding the player; the player chunk loads only on lesson pages.
- LCP ≤ 2.5 s on a mid-range Android over a throttled "Slow 4G" profile, measured in CI with Lighthouse and in the field with Web Vitals.
- Images via `next/image` (AVIF/WebP, responsive sizes); fonts self-hosted with `next/font`, subset, `display: swap`; no third-party scripts on student pages.
- Every list and detail view has a skeleton, an empty state and an error state with retry.

## 7. `frontend-internal`

### 7.1 Routes

| Area | Routes |
|---|---|
| Auth | `/sign-in`, `/sign-in/verify` (authenticator code or recovery code), `/setup-2fa` (forced on first sign-in), `/accept-invite/[token]`, `/forgot-password`, `/reset-password/[token]` |
| Overview | `/` summary dashboard, `/insights` (funnel and trends; module and quiz results) |
| Students | `/enrollments` approval queue, `/students`, `/students/[id]` |
| Courses | `/courses`, `/courses/[id]` (tabs: Details, Modules, Revisions, Front page), `/courses/[id]/modules/[moduleId]` (tabs: Content, Video, Quiz), `/courses/[id]/preview` |
| Media | `/videos` library with processing status |
| Directory | `/directory/universities`, `/directory/faculties`, `/directory/departments` |
| Site content | `/content/resources`, `/content/news`, `/content/news/[id]`, `/content/pages` (landing overview, contact), `/content/tags` |
| Administration | `/admins` (super admin only), `/audit-log`, `/account` |

### 7.2 Patterns
- **Shell**: shadcn sidebar with grouped navigation, breadcrumbs, page header with the page's primary action. On phones the sidebar collapses into a sheet.
- **Lists**: every list uses the shared `DataTable` with server-side pagination, sorting and filters kept in the URL via nuqs; parsers are shared with the API's query DTOs through `@heat/contracts`. Under `md`, tables switch to a card list.
- **Phone-friendly screens**: `/` dashboard and `/enrollments` (card list, filters in a sheet, swipe-free approve/reject buttons, bulk select) are designed and tested at phone width. Other screens are laptop-first and remain usable.
- **Forms**: one `FormField` pattern (shadcn `Field` + RHF); create and edit in the same form component; unsaved-changes guard; destructive actions behind `ConfirmDialog` with the item's name.
- **Locked content**: when a course is locked, locked fields render read-only with a lock note explaining why, and wording-fix fields show "changes are logged".
- **Rich text**: `RichTextEditor` with the simple toolbar; images upload through the media endpoint; output is JSON with a `schemaVersion`.
- **Reordering**: `SortableList` with drag handles plus Move up/down menu items.
- **Video upload**: resumable upload with progress, pause/resume, then live status (uploaded → queued → processing → ready/failed) by polling the processing-status endpoint. The module's Video tab also takes optional caption files (`.vtt`, one per language), validated by the API.
- **Quiz builder**: single-choice questions only — question text, 2–6 options, exactly one marked correct, optional explanation. The schema keeps a `type` field so other types can be added later without a migration of existing data.
- **Course preview** (`/courses/[id]/preview`, my call): rendered inside `frontend-internal` from the same shared components the lesson page uses — `VideoPlayer`, `RichTextRenderer` and a `QuizPreview` that shows the correct answers. The learner page compositions themselves stay in `frontend-public`; only these building blocks are shared through `@heat/ui`. Video uses an admin playback-session endpoint that checks the admin role instead of an enrollment, and Nginx serves `/hls` on the admin host with the same signed-cookie check.
- **Insights**: `ChartCard` grid with a shared filter bar (date range, course, university, faculty, department, session); each chart offers its data as CSV.
- **Sessions**: admin sessions expire after 30 minutes idle (my call); deactivating an admin revokes their sessions at once; role-restricted pages are hidden in navigation and enforced by the API.

## 8. `@heat/ui` design system

- Base: shadcn/ui on Base UI, themed only through CSS variables in `styles.css` (light and dark). Tokens from the Open Pencil designs: color roles, type scale, radius, spacing, shadows, chart colors.
- Fonts: Source Serif 4 for display and headings, Public Sans for interface text, both self-hosted and set in `docs/design/tokens.json`.
- Composites shared by both apps: `AppShell` (sidebar + top bar + mobile bottom bar / sheet), `PageHeader`, `DataTable`, `FilterBar`, `FormField`, `StatusBadge` (one mapping for enrollment, video and course states), `EmptyState`, `ErrorState`, `ConfirmDialog`, `StatCard`, `ChartCard`, `FileUpload`, `VideoPlayer`, `RichTextEditor`, `RichTextRenderer`, `SortableList`, `CaptchaField`, `ThemeSwitch`, `NotificationBell`.
- **Styling rules, enforced by lint**: no `.css` files in apps other than the single entry that imports `@heat/ui/styles.css`; no inline `style`; no arbitrary Tailwind values (`[...]`) outside `@heat/ui`; class order and conflicts checked (`eslint-plugin-better-tailwindcss` or equivalent); apps use Tailwind only for layout (grid, flex, gap, spacing tokens).
- **No-filler rule** in review checklists: every element on a screen must serve that screen's task; no decorative cards, banners or stat tiles unless the numbers are the point of the page.
- Every component has a Storybook story with light and dark variants and passes the axe check.

## 9. Images and files

Every uploaded image or file goes through one `media` module in the API and one storage interface. It is cleaned and resized once at upload, stored on the VPS disk, and served by Nginx — never streamed through Node.

### 9.1 What is stored, and who may see it

| Kind | Examples | Visibility | Served as |
|---|---|---|---|
| Public images | course and module thumbnails, news images, landing images | `public` | `/media/public/…`, cached for a year (keys never change) |
| Public files | resources (PDF, DOCX, PPTX) | `public` | `/media/public/…` with `Content-Disposition: attachment` |
| Course content | images inside lesson text | `protected` (approved or completed students of that course, and admins) | short-lived signed URL checked by Nginx (same HMAC scheme as HLS) |
| Captions | `.vtt` files per video and language | same as the video | stored under the video's `/hls/<videoId>/` path, covered by the playback cookie |
| Personal | profile pictures | `private` (owner and admins) | API checks access, then Nginx sends the file (`X-Accel-Redirect`) |
| Certificates | PDFs | `private` (owner and admins) | same as profile pictures |
| Brand | HEAT, partner and University of Dhaka logos | in the repo | static files in each app's `public/` |

### 9.2 Upload pipeline
1. The browser uploads to the API (multipart for images and documents; tus only for videos). Size limits: images 10 MB, documents 25 MB, captions 1 MB.
2. The API checks the real file type from its bytes, not the name or extension. Allowed: JPEG, PNG, WebP and AVIF images; PDF, DOCX and PPTX documents; WebVTT captions. **SVG and other script-capable formats are rejected.**
3. Images are decoded with sharp (pixel limit against decompression bombs), metadata (EXIF, GPS) is stripped, and the image is re-encoded. The original upload is not kept.
4. Responsive variants are generated once: WebP at 320, 640, 1280 and 1920 px wide (never upscaled), plus a 1:1 crop for profile pictures. Content images also get an AVIF set.
5. Files are written under a random key, never the user's file name: `media/<visibility>/<yyyy>/<mm>/<uuid>/<variant>.webp`. The write is atomic (temporary file, then rename).
6. A `MediaAsset` row records key, kind, visibility, MIME type, size, width, height, SHA-256, variants, uploader, and alt text (required for content and news images).

### 9.3 How pages reference images
- Rich text and records store the **asset ID**, never a URL, so the URL scheme can change later (for example a CDN) without touching content.
- The API resolves asset IDs to URLs when it returns data: plain public URLs for public assets, or signed URLs (1 hour) for protected ones. Lesson pages are already per-student and uncached, so signed URLs do not break caching.
- `next/image` uses a **custom loader** that picks the nearest pre-generated width. Next.js's built-in image optimizer is turned off, so the 4-vCPU VPS never resizes images while students browse.

### 9.4 Housekeeping
- An asset is linked to the record that uses it. Unlinked uploads (for example an image added to a draft and then removed) are deleted by a daily cleanup job after 24 hours.
- Replacing a profile picture deletes the old one.
- The media volume is part of the nightly encrypted off-site backup.
- The storage interface has a local-disk driver now. An S3-compatible driver can be added later without changing any other code.
- **Owner decision (2026-11-07): local disk, no object-storage server.** MinIO was considered and rejected: its free edition stopped shipping images in October 2025 and its repository was archived in 2026, and on a single VPS an object store adds a network hop for every file without adding durability. If off-server file storage is needed later, add a cloud S3 driver (Cloudflare R2, Backblaze B2 or AWS S3).

## 10. Security in the frontends
- Cookies host-only, `Secure`, `HttpOnly`, `SameSite=Strict`; CSRF double-submit as in §5.
- Content Security Policy without `unsafe-inline` scripts. Dynamic pages use per-request nonces set in `proxy.ts`; cached pages must not become dynamic because of the nonce — the builder verifies the approach (hash or SRI-based policy for static pages) in a spike and records it in an ADR.
- Lesson text and news are rendered only through the allow-listed static renderer; links limited to `https:` and `mailto:`; no `dangerouslySetInnerHTML` with author content anywhere.
- No secrets in `NEXT_PUBLIC_*`; the revalidation secret lives only on the server.
- Admin app sends `X-Robots-Tag: noindex` and is never linked from the public site.

## 11. Testing
- `@heat/ui`: Storybook stories, Vitest interaction tests, axe checks per story.
- Apps: Vitest for hooks and utilities; MSW mocks generated by orval for page-level tests.
- Playwright journeys: enroll → verify → approved → watch → quiz → certificate; admin approve/reject/remove; course build and lock; directory delete rules. Run at phone and laptop sizes, light and dark.
- Accessibility: axe on key pages (lesson player, forms, data table, editor, quiz); keyboard tests for dialogs, menus and reordering.
- Visual regression: Playwright `toHaveScreenshot()` in a pinned Docker image.
- Performance: Lighthouse CI on landing, dashboard and lesson pages with the Slow 4G profile and the budgets in §6.4.

## 12. Backend changes this design needs
- `GET /me` returning the user, role and a list of per-course enrollments with status and reason.
- Signed-in "request to enroll" endpoint for further courses.
- Admin playback-session endpoint for course preview; Nginx `/hls` on the admin host.
- Caption upload per video and language; captions served under the video's signed path.
- `media` module and `MediaAsset` table as in §9, Nginx locations for public, signed and `X-Accel-Redirect` media.
- Notifications module: list, unread count, mark read; events written by enrollment decisions, certificate issue and news publish (news never emails).
- Refresh-token grace window (§5.4) and CSRF token issuance.
- OpenAPI spec generated from NestJS with Zod-based DTOs, published as a build artifact consumed by orval in CI (a drift check fails the build when the client is stale).
- Internal revalidation call to `frontend-public` on content changes, with the tags listed per entity.
- Quiz attempt idempotency keys; progress heartbeats with sequence numbers.
- Server-side cap on accepted watched ranges (elapsed time × top playback speed).
- Profile change requests for name and academic details, approved by admins; emailed code for password change.
- `__Host-` cookies, Lax access and Strict refresh cookies, session-bound HMAC CSRF tokens.
- Admin grant-extra-attempt action; certificate stores the name it was issued with.

## 13. Left to the builder
- Exact token values, the font family, and icon choices — from the Open Pencil designs.
- File structure inside each app beyond the route map (feature folders are preferred: `app/` for routes, `features/<area>/` for components and hooks).
- Polling intervals other than notifications, exact cache lifetimes, Storybook organization.
- Whether `@heat/ui/data` is ever used in `frontend-public`.

## 14. How this fits the project plan
- This document replaces the frontend parts of the project plan: apps are named `frontend-public` and `frontend-internal`, Zustand and Vidstack are dropped, and Video.js v10, orval, nuqs, Tiptap and the media design above are added.
- Work is planned as **vertical slices**: each ticket delivers the API endpoint, the generated client and the screen together, with tests across both. Frontend-only work against mocks is limited to `@heat/ui` components in Storybook.
- **Design gate**: the Open Pencil designs and theme are a phase-0 deliverable the owner approves. No screen ticket starts before approval; setup, API, media and video work can proceed in parallel.
- The project plan's backlog (E1, E5, E6, E9, E10, E11, E13) is updated to match this document when the GitHub issues are created.
