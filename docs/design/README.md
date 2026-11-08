# HEAT LMS design file and theme

Issue #30. This directory holds the Open Pencil designs for the key student and admin screens and the theme they share. The designs are a proposal until the owner approves them with a comment on #30 that names the commit or file version and says "Open Pencil designs and theme approved". Merging the pull request is not approval.

Design rule from the owner (2026-11-08): one consistent, modern design that fits the theme (calm, trustworthy, safe, University of Dhaka gender-safety training), and a drawer wherever a modal or dialog would otherwise be used. No decorative or filler element. The demo mock (`HEAT Gender Safety Training Platform.png`, kept outside the repository) is a direction, not a spec: its deep purple, lavender tints, warm amber highlight and green progress colour are the starting palette.

## Status

| Slice | Content                                                                                    | State                                                    |
| ----- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| 30a   | Tooling, `tokens.json`, font decision, checks, README skeleton                             | Done                                                     |
| 30a   | `heat-lms.fig` with the theme variables and specimen frames, exports, inventory entries    | Done: colour, type, shape and status specimens, English  |
| 30b   | Student screens                                                                            | Not started                                              |
| 30c   | Admin screens, drawers, loading, empty and error states, the no-filler table below         | Not started                                              |

## Files

| File                    | What it is                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `heat-lms.fig`          | The Open Pencil native file. Binary: one editor at a time (see Working on the file)                    |
| `exports/<frame-id>.png` | One PNG per frame, named exactly like the frame                                                         |
| `tokens.json`           | The theme as data: colour roles for light and dark, contrast pairs, type scale, radius, spacing, shadows, font |
| `inventory.json`        | Every frame with its id parts; `overlay: "drawer"` on every overlay                                     |

## How to open the design file

1. Install Open Pencil (the desktop application). The version used for the file is recorded under Open Pencil below.
2. Open `docs/design/heat-lms.fig`.
3. Install the font from Font below, or Open Pencil falls back to a different face and Bangla specimens will look wrong.
4. Without Open Pencil, read the PNGs in `exports/`. `inventory.json` lists what each one shows.

## Open Pencil

| Item                  | Value                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Application version   | 0.16.0 (`/Applications/OpenPencil.app`, `@open-pencil/mcp` 0.16.0)                                                                           |
| Tool limits found     | The MCP server only writes inside its configured root (`OPENPENCIL_MCP_ROOT`, by default the directory the bridge was started in). Its tools fail with "not connected" until the application is running with a document open. |

| Language of the designs | English only for version 1 (owner decision, 2026-11-08). The Bangla variants are not designed. |
| Bangla glyphs         | Open Pencil 0.16.0 draws Noto Sans Bengali Regular from the installed font, but its Bold and SemiBold faces come from Google and drop whole lines that contain digits or some conjuncts; SemiBold drew no Bangla at all. Bangla weights cannot be checked in the file. |
| Modes                 | The tools cannot add a mode to a collection. A collection is created by importing one token file per mode (`Colors/Light.json`, `Colors/Dark.json`), which gives real Light and Dark modes. |
| Frame fills           | Frames cannot be switched between modes through the tools, so each specimen frame uses literal hex values equal to the variable for its theme. |
| Saving                | The tools write only inside the MCP root, and not into hidden folders. The file and PNGs were written to the main checkout and copied into the worktree. |

Limits found while building the file are added to this table as they appear.

## Frame naming and the inventory

Frame id: `<area>-<screen>-<width>-<theme>-<lang>`, lower case, hyphens only. The export file is `<frame-id>.png`.

| Part     | Values                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------- |
| `area`   | `student`, `admin`, `specimen`, `drawer`                                                                  |
| `screen` | kebab-case screen or state name, for example `dashboard`, `dashboard-loading`, `module-editor-locked`    |
| `width`  | `phone` (390 px) or `laptop` (1440 px)                                                                    |
| `theme`  | `light` or `dark`                                                                                         |
| `lang`   | `bn` or `en`. The admin console is English only, so `admin` frames are always `en`                       |

Drawers are named `drawer-<purpose>-<width>-<theme>-<lang>` (area `drawer`, screen is the purpose) and carry `"overlay": "drawer"` in `inventory.json`. A drawer slides in from the inline-end edge on laptop and from the bottom on phone, has a title and a visible Close button (no drag gesture needed, WCAG 2.5.7), and its notes cover focus on open, Escape and focus return. Menus, tooltips and select lists are not overlays in this sense.

## Checks

```sh
pnpm design:contrast   # every pair, both themes, with its ratio; exits 1 on any failure
pnpm design:check      # tokens, contrast, inventory against exports, drawer-only overlays
```

`packages/config/test/design-files.test.mjs` runs the same checks on these files, so `pnpm test` and CI fail when a pair drops under its ratio, light and dark keys drift apart, an export has no inventory entry, a frame has no export or an overlay is not a drawer. The contrast function (`packages/config/src/contrast.mjs`) takes plain hex strings, so #31 can run it on values parsed from `styles.css`.

What the machine does not check: whether the design file matches `tokens.json`, whether a frame looks right, and the no-filler table below. Those are reviewed by eye.

## Tokens

`tokens.json` uses the shadcn variable names, so #31 maps each role to a CSS variable one to one. Colours are opaque sRGB hex.

- Roles: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive` (each with a `-foreground`), `border`, `input`, `ring`, `chart-1` to `chart-5`, and the `sidebar` family.
- Added roles, not in the shadcn set: `divider` (decorative rules, no contrast requirement, so `border` can stay at 3:1 for control edges), `link`, `disabled` and `disabled-foreground` (the only exempt pair), `player` and `player-foreground` (the video controls, dark in both themes), and for each status tone a `status-<tone>` fill, `status-<tone>-foreground` and `status-<tone>-mark`.
- Status tones: `neutral`, `info`, `success`, `warning`, `danger`, `brand`. `statusTones` maps every StatusBadge state to a tone, so the same meaning always looks the same.

| Group      | State                  | Tone      |
| ---------- | ---------------------- | --------- |
| Enrollment | `pending-verification` | `info`    |
| Enrollment | `pending-approval`     | `warning` |
| Enrollment | `approved`             | `success` |
| Enrollment | `completed`            | `brand`   |
| Enrollment | `rejected`             | `danger`  |
| Enrollment | `expired`              | `neutral` |
| Enrollment | `removed`              | `danger`  |
| Video      | `uploading`            | `info`    |
| Video      | `uploaded`             | `info`    |
| Video      | `queued`               | `neutral` |
| Video      | `processing`           | `info`    |
| Video      | `ready`                | `success` |
| Video      | `failed`               | `danger`  |
| Video      | `rejected`             | `danger`  |
| Course     | `draft`                | `neutral` |
| Course     | `published`            | `success` |
| Course     | `locked`               | `warning` |

The enrollment states are from ADR 0011, the video states from the video processing diagram in the plan, and the course states from ADR 0004 (draft, published, and the lock taken at the first approval). The spec does not list the course states as a closed set; if the API adds one, add it to the tones and to `STATUS_STATES` in `packages/config/src/design-checks.mjs` in the same change.

Every state carries a text label and an icon as well as its colour (WCAG 1.4.1); the colour alone never carries the meaning.

Contrast rules checked in `pnpm design:contrast`:

| Kind                 | Ratio | Pairs                                                                                                                                                     |
| -------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text                 | 4.5:1 | each `-foreground` on its base; `foreground` on `background`, `card`, `popover`, `muted`, `secondary`, `accent`; `muted-foreground` on `background`, `card`, `muted`; `link`, `primary`, `destructive` and each `status-<tone>-mark` on `background` and `card` |
| Non-text             | 3:1   | `input`, `border` and `ring` on `background` and `card`; `sidebar-ring` and `sidebar-primary` on `sidebar`; each `chart-N` on `card`                       |
| Large text           | 3:1   | only when a pair is declared `large-text` in `tokens.json`; none are declared today                                                                        |
| Exempt               | none  | `exempt: "disabled"`, and only for pairs that name a disabled role                                                                                         |

The spec asks for the focus ring on the sidebar fill; the sidebar uses its own `sidebar-ring`, so that is the role checked there.

Type scale (`type.styles`), size and line height in px for Latin and Bangla. Bangla line height is always looser than Latin so matras and conjuncts are not clipped, and body text is never under 16 px:

| Style       | Size | Weight | Latin | Bangla |
| ----------- | ---- | ------ | ----- | ------ |
| `display`   | 40   | 700    | 48    | 60     |
| `heading-1` | 32   | 700    | 40    | 52     |
| `heading-2` | 24   | 600    | 32    | 40     |
| `heading-3` | 20   | 600    | 28    | 36     |
| `body-lg`   | 18   | 400    | 28    | 32     |
| `body`      | 16   | 400    | 24    | 28     |
| `label`     | 14   | 600    | 20    | 24     |
| `small`     | 14   | 400    | 20    | 24     |

Radius: 6, 10, 14, 20 and full. Spacing: 4 px base with steps 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Shadows: `sm`, `md`, `lg` for each theme, shown as layers of x, y, blur, spread, colour and opacity.

## Font

The font is Noto Sans Bengali, as the self-hosted variable build `@fontsource-variable/noto-sans-bengali` 5.3.0 (the temporary font in `@heat/ui` today). Licence: SIL Open Font License 1.1. Weights used: 400, 600, 700. Subsets: Bengali and Latin only, `font-display: swap`, no CDN. The package's `latin-ext` file is declared with a `unicode-range`, so it downloads only when a page uses those characters.

Decision: keep Noto Sans Bengali. One family covers Bengali and Latin, it is OFL, it is already in the repository, and it is the smallest of the three candidates that were measured. Hind Siliguri and Anek Bangla were compared on woff2 size only; their rendering was not compared by eye (see the open item below).

| Candidate                            | Licence | Bengali    | Latin     | Total (Bengali + Latin) | Notes                                                       |
| ------------------------------------ | ------- | ---------- | --------- | ----------------------- | ----------------------------------------------------------- |
| Noto Sans Bengali Variable 5.3.0     | OFL 1.1 | 107,720 B  | 25,604 B  | 133,324 B (130 KiB)     | One variable file per subset covers every weight            |
| Hind Siliguri 5.3.0 (static)         | OFL 1.1 | 218,816 B  | 43,676 B  | 262,492 B (256 KiB)     | Three weights, three files per subset                       |
| Anek Bangla Variable 5.3.0           | OFL 1.1 | 155,676 B  | 42,816 B  | 198,492 B (194 KiB)     | One variable file per subset, `wght` axis                   |

Sizes are the woff2 files measured on disk (`wght` files for the variable builds; weights 400, 600 and 700 for Hind Siliguri). The 133 KB for Noto is within the slow-network budget in the frontend design (section 6.4), because the two files load once and are cached.

A finding for #31: the package's default `index.css` imports the `wght` files above, so the default import is the small one. The `standard` and `wdth` files are 190,040 B for Bengali and 44,580 B for Latin and should not be imported.

Bangla is out of scope for the designs in version 1, so the following check is parked until Bangla is designed. Open item: the Bangla specimen (conjuncts ক্ষ, জ্ঞ, ন্দ্র, স্ত্র; reph র্ক; vowel signs; ya-phala; khanda-ta ৎ; Bengali digits at every weight) has to be checked by eye in Open Pencil before approval. Open Pencil cannot draw the Bold and SemiBold Bangla faces (see Open Pencil above), so that check needs the font installed locally or a browser check in #31.

## Constraints and what is not designed

- Widths: 390 px (phone) and 1440 px (laptop) only. Widths below 390 px and the 768 px tablet width are not designed; the layout switches at the `md` breakpoint.
- Bengali digits in `bn` frames, Latin digits in `en` frames. Dates are in Asia/Dhaka time.
- Logos are clearly marked placeholders. The final marks arrive with #35 and are not part of the approval.
- The text captcha is an accepted accessibility exception (ADR 0017); the support contact sits beside it.
- Touch targets for approve and reject on phone are at least 44 px.
- Frames use only `@heat/ui` patterns and tokens: the same table, form, drawer and feedback pattern in both apps, and no value outside the tokens.

## Working on the file

`heat-lms.fig` is binary and does not merge. One editor at a time: say in the issue who has it, commit the file and its exports together, and never rebase over someone else's change to it.

## How the tokens were compared with the file

The theme is an Open Pencil collection named `Colors` with Light and Dark modes and 56 colour variables, created by importing `tokens.json` colours one file per mode. After saving, `list_variables` returned 56 colour variables with a value for each mode; the values read back match `tokens.json` in every spot check (for example `background` is `#fbfafe` in Light and `#0f0b1a` in Dark, `primary` is `#5b2d9a` and `#b99cf3`). The comparison was not run role by role by a script. The specimen frames use the same hex values and were compared by eye against the exports in `exports/`.

Radius, spacing and shadow are shown on the shape specimen with the token values; they are not stored as variables.

## Per-screen no-filler table

Filled in by 30b (student screens) and 30c (admin screens). Each screen has a row for its task and one line per element group saying which part of the task it serves. The demo-mock elements (the "Safe Campuses" speech bubble, the four feature tiles under the hero, the skyline illustration, the four dashboard tiles) are justified here or dropped.

| Screen | Task | Element group | Part of the task it serves |
| ------ | ---- | ------------- | -------------------------- |
