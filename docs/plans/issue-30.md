# Open Pencil designs and theme: implementation plan

**Issue:** #30 (E1, size L, type feature, area design). Branch `feat/30-open-pencil-designs-key`, based on `epic/e1-design-system-and-app-shells`. The refined acceptance criteria in the issue are the spec. Design approval is a separate owner comment on the issue and is not part of this plan.

## Goal

Give the owner one consistent, modern design to approve before any screen work starts: a theme (colour roles, type scale, radius, spacing, shadows, chart colours, light and dark), a font decision, and the key student and admin screens at phone and laptop width. Everything that can be checked by a machine is checked in CI: contrast, light and dark key parity, inventory against exports, and the drawer-only overlay rule. The design itself is reviewed by eye.

Owner design rule of 2026-11-08, applied to every frame: one design language, calm, trustworthy and safe, in the University of Dhaka gender-safety context, and a drawer wherever a modal or dialog would otherwise appear. No decorative or filler element.

## Delivery in three slices

One issue, one pull request, three slices committed in order on this branch.

| Slice | Content                                                                                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30a   | Tooling and its tests, `tokens.json`, `docs/design/README.md` skeleton, the font decision, the theme and specimen frames in `heat-lms.fig`, `design:contrast`, `design:check` |
| 30b   | Student screens: landing, enrolment (details, captcha, success), awaiting approval, dashboard, course, lesson, quiz (question, review, result), with loading, empty and error  |
| 30c   | Admin screens: overview, approvals, students, module editor, insights, the drawers, loading, empty and error states, the final README no-filler table                         |

## Chosen approach

- **Source of truth for values is `docs/design/tokens.json`.** The design file carries the same values as Open Pencil variables (collections with Light and Dark modes where the tool supports it, otherwise swatch frames labelled with hex). The README records how the two were compared. #31 turns `tokens.json` into `packages/ui/src/styles.css`; shadcn variable names are used so that mapping is one to one.
- **Pure functions, Node built-ins only** in `packages/config/src` (`.mjs`, like `audit.mjs` and `ticket.mjs`), thin scripts in `packages/config/bin`, tests in `packages/config/test`. `contrast.mjs` is WCAG 2 relative luminance and ratio on hex strings, so #31 can run the same function on values parsed from `styles.css`.
- **The pair list lives in `tokens.json`** (`pairs`), and `design-checks.mjs` derives the pairs that must exist from the roles (every `-foreground` on its base, the text and non-text pairs of the refined spec, the status tones). A missing required pair fails, so deleting a pair cannot make the check green.
- **Status colours are tones**, not one colour set per state: `neutral`, `info`, `success`, `warning`, `danger`, `brand`, each with a fill, a foreground and a mark colour. `tokens.json` maps every enrolment, video and course state to a tone, so the same meaning always looks the same and a new state cannot be added without a tone.
- **Inventory** is `docs/design/inventory.json`: one entry per frame with the id parts repeated as fields, so a test can check them against the id. Exports are `docs/design/exports/<frame-id>.png`.
- **Drawer rule in data:** an entry with an `overlay` field must say `"drawer"`; an id or screen containing `modal`, `dialog` or `popup` fails.
- **Font:** default is to keep Noto Sans Bengali Variable (one family, Bengali and Latin, OFL, already self-hosted at 130 KB for the two subsets, three weights). Hind Siliguri and Anek Bangla are measured and compared in the README; the default changes only for a measured reason.
- **Open Pencil** is driven through its MCP tools. If the application is not connected the design file and exports are not produced and the slice reports the blocker; nothing is faked.

Alternatives not chosen: a Style Dictionary or other build step (a dependency for a one-way copy that #31 owns); a pair list only in code (the design review needs to see it next to the colours); one status colour set per state (17 states, drift between equal meanings).

## Files

| File                                                           | Change                                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/config/src/contrast.mjs`                             | new: hex parsing, relative luminance, contrast ratio                    |
| `packages/config/src/design-checks.mjs`                        | new: token validation, required pairs, contrast rows, inventory checks  |
| `packages/config/bin/design-contrast.mjs`, `design-check.mjs`  | new: print and exit                                                     |
| `packages/config/test/contrast.test.mjs`                       | new                                                                     |
| `packages/config/test/design-checks.test.mjs`                  | new: inline fixtures                                                    |
| `packages/config/test/design-cli.test.mjs`                     | new: the two scripts against temporary files                            |
| `packages/config/test/design-files.test.mjs`                   | new: the real `docs/design` files pass in CI                            |
| `package.json`                                                 | scripts `design:contrast`, `design:check`                               |
| `docs/design/tokens.json`, `inventory.json`, `README.md`       | new                                                                     |
| `docs/design/heat-lms.fig`, `docs/design/exports/*.png`        | new (needs the Open Pencil application)                                 |
| `README.md`                                                    | short section on the design commands                                    |

## Tasks (slice 30a)

Each task is one commit: failing test first, see it fail for the right reason, least code, tick the box in the same commit.

- [x] **Task 1: contrast function.** Tests first in `test/contrast.test.mjs`: `#000000` on `#ffffff` is 21, equal colours are 1, the ratio is symmetric, `#777777` on white is about 4.48 and fails 4.5, `#767676` passes, short hex `#fff` is accepted, alpha hex, named colours and garbage throw. Red: module missing. Then `src/contrast.mjs`.
- [x] **Task 2: token validation.** Tests first in `test/design-checks.test.mjs` with an inline valid fixture and one mutation per case: light and dark keys differ, a role is not a hex, a `-foreground` has no declared pair, a pair names an unknown role, a required pair is missing, `exempt` is anything but `disabled` or sits on a role that is not a disabled role, a `large-text` pair is checked at 3:1, a status state has no tone or an unknown tone, a type style uses an undeclared weight, a body size under 16, Bangla line height not looser than Latin, a spacing value off the 4 px base, a shadow layer missing a field, `font` missing a key. Red: no module. Then `validateTokens`.
- [x] **Task 3: contrast rows.** Tests first: `contrastRows` returns one row per pair and theme with ratio, required ratio and verdict; text needs 4.5, large text and non-text need 3, an exempt pair is reported as exempt and never fails; a failing pair is named in the failure list. Then `contrastRows` and `requiredPairs`.
- [x] **Task 4: inventory checks.** Tests first: an export without an entry, an entry without a file, an id that breaks the pattern, id parts that disagree with the fields, a duplicate id, an overlay not marked `drawer`, an id naming a modal or dialog, an unknown area, width, theme or language. Then `checkInventory`.
- [x] **Task 5: scripts.** Tests first in `test/design-cli.test.mjs`: `design-contrast.mjs --tokens <file>` prints a table with every pair and exits 0 for a good file and 1 with the failing pair named for a bad one; `design-check.mjs --design-dir <dir>` exits 1 on a missing export. Then the two scripts and the root scripts `design:contrast` and `design:check`.
- [x] **Task 6: real files are checked in CI.** Test first in `test/design-files.test.mjs`: `docs/design/tokens.json` and `inventory.json` pass every check. Red: files missing. This test is the CI hook, because `pnpm test` runs it.
- [x] **Task 7: the theme.** Write `docs/design/tokens.json` in full (palette from the demo mock's direction: deep purple, lavender tints, a warm amber accent, green progress). Run `pnpm design:contrast`, iterate colours until every pair passes in both themes. Task 6 turns green.
- [x] **Task 8: README skeleton and font decision.** `docs/design/README.md`: how to open the `.fig`, Open Pencil version, font source and licence, the font decision with measured woff2 sizes, constraints and widths not designed, one editor at a time, the per-screen no-filler table to be filled in 30b and 30c, how tokens were compared with the file. Root `README.md` gets the two commands.
- [x] **Task 9: Open Pencil theme and specimen file.** `docs/design/heat-lms.fig` holds the `Colors` collection with Light and Dark modes (56 roles) and eight specimen frames in English: colours, type scale, radius, spacing and shadow, and one StatusBadge per state, each in light and dark, exported to `docs/design/exports/` and listed in `inventory.json`. Owner decision 2026-11-08: designs are English only for version 1, so no Bangla frames. Open Pencil cannot draw Bold or SemiBold Bangla, recorded in the README.
- [x] **Task 10: verify tokens against the file** and record the method in the README. Read back with `list_variables`; all 56 roles have both modes and the spot checks match `tokens.json`. Not run role by role by a script.

## Tasks (slice 30b, student screens)

Owner decision 2026-11-08: designs are English only, so every frame has lang `en` and there are no Bangla frames. Each screen is built at laptop (1440) and phone (390), in light and dark, with literal token hex values per theme (the tools cannot switch a frame's variable mode). One task is one commit: the frames in `heat-lms.fig`, the exports, the inventory entries and the README no-filler rows for that screen. The file is saved and exports are written after each task.

- [ ] **Task 11: public chrome and landing.** Header (HEAT logo placeholder, University of Dhaka crest placeholder, nav, theme switch, Sign in, Enroll), footer with partner placeholders, and `student-landing`: the course promise, one Enroll action, what the training covers, who runs it. Demo-mock elements are justified or dropped in the README.
- [ ] **Task 12: enrolment.** `student-enroll-details`, `student-enroll-captcha` (captcha image, refresh, input, support contact), `student-enroll-success`.
- [ ] **Task 13: awaiting approval.** `student-awaiting-approval` with resend verification and profile link, plus the removed, rejected and expired states with reason text.
- [ ] **Task 14: learner shell and dashboard.** Sidebar and top bar on laptop, 5-item bottom bar on phone. `student-dashboard`, `student-dashboard-loading`, `student-dashboard-empty`, `student-dashboard-error`.
- [ ] **Task 15: course and lesson.** `student-course` with module list and locked or completed marks, `student-lesson` (phone: video on top with Lesson, Objectives and Modules tabs; laptop: main column with side panel).
- [ ] **Task 16: quiz.** `student-quiz-question`, `student-quiz-review`, `student-quiz-result-pass`, `student-quiz-result-fail` with the waiting-time countdown, and `drawer-quiz-submit-unanswered`.

Slice 30c (admin screens, states, drawers, final no-filler table) is planned when 30b is reviewed.

## Acceptance criteria mapped to checks

| Criterion (refined)                                                                  | Check                                                                                         |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `.fig`, exports, `tokens.json`, `inventory.json`, README exist; README says how to open | Files in the PR; `design-files.test.mjs`; reading the README                                  |
| `tokens.json` has every role, status, type, radius, spacing, shadow and font entry   | Task 2 tests; `design-files.test.mjs`                                                         |
| Light and dark keys identical; every `-foreground` has a pair; pairs name real roles | Task 2 tests; `design-files.test.mjs`                                                         |
| Each token matches the design file                                                   | Task 10, method in the README (by eye and by variable read-back)                              |
| Every frame has an export and every export an entry                                  | Task 4 tests; `pnpm design:check`                                                             |
| Every listed screen at phone and laptop, light and dark, in English                  | Inventory and exports reviewed by eye in 30b and 30c                                          |
| Overlays are drawers                                                                 | Task 4 tests; `pnpm design:check`; drawer frames reviewed by eye                              |
| Text pairs 4.5:1, non-text 3:1, large text only when declared, disabled exempt       | Tasks 1, 3 and 7; `pnpm design:contrast` exits 0                                              |
| Font: one family, Bengali and Latin, at most three weights, Bangla specimen          | Task 2 tests (weights); specimen frames and README decision (by eye)                          |
| No-filler table per screen                                                           | README rows filled in 30b and 30c; reviewer reads them                                        |
| Owner approval comment                                                               | Owner's comment on #30, outside this branch                                                   |

## Verification

```sh
pnpm install --frozen-lockfile
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build
pnpm design:contrast
pnpm design:check
pnpm verify
```

The `.fig` is opened in Open Pencil and its frames are compared with the exports and `tokens.json` by eye. The pull request states the Open Pencil version, any limit found, and what was checked only by eye.

## Risks and edge cases

- `*.png` is listed in `.prettierignore`, not in `.gitignore`; `git check-ignore` confirms exports are tracked without a change. The refined text assumed a `.gitignore` rule, which does not exist.
- The Open Pencil MCP server only writes inside its configured root, which is the main checkout, not this worktree. The file has to be created where the server may write, or the root pointed at the worktree, and then copied here without touching the main checkout's tracked or untracked files.
- A binary `.fig` merges badly: one editor at a time.
- Bangla is longer and taller than Latin: every specimen and screen is checked for clipped matras and wrapping at 390 px.
- No comments in code: the scripts and tests carry meaning through names; `docs/` prose is exempt.
