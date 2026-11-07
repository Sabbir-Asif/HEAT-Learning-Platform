# `/implement-issue` skill implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A `/implement-issue <N>` skill that drives a ticket through the eight workflow stages, with refiner, reviewer and security reviewer agents, and a tested script for the GitHub rules.

**Architecture:** The rules that must not drift (may this ticket start, branch name and base, append-only refinement, board moves) live in one script in `@heat/config`, written like `github-setup.mjs`: logic in `src/ticket.mjs` taking an injected `gh`, a thin `bin/ticket.mjs`, tests against a fake `gh`. The skill (`.claude/skills/implement-issue/`) calls the script and holds the judgement work: refining, planning, TDD, verifying, review and the PR. The three agents live in `.claude/agents/` and read the same quality bar as the implementer.

**Tech Stack:** Node 22 ESM, `gh` CLI (GraphQL and REST), Vitest, Claude Code skills and subagents.

**Spec:** issue #24 including its "Refined" section; plan section 12 (Workflow), 11 (labels, fields), 14 (collaborator-only comments, refiner appends); ADR 0010.

## Global Constraints

- Branch: `<type>/<N>-<slug>`; type label → prefix: `type:feature` `feat`, `type:bug` `fix`, `type:chore` `chore`, `type:docs` `docs`, `type:spike` `spike`.
- Base: the epic's `epic/<code>-…` branch on `origin` when it exists (code from the epic title, `E0 · …` → `e0`), otherwise `main`. The PR targets the same base.
- May start only when: project Status is `Ready` or `Refining`; no `blocked` label; every "blocked by" issue is closed or has a merged PR into an `epic/*` branch whose body says `Closes|Fixes|Resolves #<blocker>`; the issue author is a collaborator; the issue is open and on the "HEAT LMS" project.
- Collaborator = author association `OWNER`, `MEMBER` or `COLLABORATOR`. Other comments are dropped and counted.
- Approval pause: size `L` or label `security`.
- Labels on start: add `in-progress`, remove `needs-refinement` and `ready`. Status names: `In progress`, `In review`.
- Never merge, never force-push, never `prisma migrate reset`, never read `.env` files. No `Co-Authored-By` or "Generated with" lines.
- `gh` is always called with an argument array (no shell) and bodies go through stdin.

## Review Focus

1. A blocker merged into a different epic's branch (not ours) still counts as done. Test: `loadTicket` with a blocker PR based on `epic/e3-…` → no refusal.
2. A closing keyword inside a longer word or for a different number (`Closes #230` when the blocker is #23) does not count. Test in Task 1.
3. Issue body edited by someone between read and write during refinement: the append must not overwrite it. `appendRefinement` reads again just before writing and stops if the body changed, then reads back after writing and fails unless it is exactly what was written. GitHub has no compare-and-swap, so a very short window remains. Test in Task 2.
4. Issue title of only punctuation or Bangla gives an empty slug. Fallback slug `issue`. Test in Task 1.
5. Issue number argument like `24; rm -rf` or `-1`. `parseCli` rejects anything but a positive integer. Test in Task 3.

---

### Task 1: `loadTicket` — ticket context and the may-start rule

**Files:**

- Create: `packages/config/src/ticket.mjs`
- Test: `packages/config/test/ticket.test.mjs`

**Interfaces:**

- Produces: `loadTicket({ gh, repo, number, localBranches = [] }) -> Ticket`, `branchFor(issue, heads) -> { name, base }`, `slugify(title) -> string`, `closesIssue(body, n) -> boolean`, constants `defaultRepo`, `projectTitle = "HEAT LMS"`.
- `Ticket = { number, title, url, state, author, labels: string[], body, type, size, status, epic: {number,title}|null, blockers: [{number,title,state,closingPr:number|null,done}], subIssues: [{number,title,state}], comments: [{author,association,createdAt,body}], hiddenComments: number, branch: {name, base, existsRemote, existsLocal}, pr: {number,state,url}|null, needsApproval: boolean, planApproved: boolean, refusals: string[], projectItem: {projectId,itemId}|null }`
- `gh` calls: one GraphQL query for the issue (labels, author association, parent, blockedBy, subIssues, comments with authorAssociation, projectItems with Status and Size), `api repos/<repo>/git/matching-refs/heads/` for branches, `pr list --state merged --limit 200 --json number,body,baseRefName`, `pr list --head <branch> --state all --json number,state,url`.
- `planApproved` is true when a comment from the OWNER association contains the marker `<!-- implement-issue:plan-approved -->`. It is a record for resuming, not a gate: the `gh` account is the owner's, so the agent could write it. The owner's chat approval is the gate.

- [x] **Step 1: Write the failing tests** with a fake `gh` returning canned JSON. Cases:
  - ready ticket → `refusals: []`, `branch: { name: "chore/24-implement-issue-skill-refiner", base: "epic/e0-engineering-foundation" }` for title "`/implement-issue` skill with refiner, reviewer and security reviewer agents"
  - label `blocked` → refusal mentions `blocked`
  - Status `Backlog` → refusal names the status and the allowed ones
  - open blocker #23 with merged PR body `Closes #23 (part of E0, #2)` into `epic/e0-…` → `done: true`, `closingPr` set, no refusal; same with base `epic/e3-x`
  - open blocker #23 with only a PR saying `Closes #230`, or an unmerged one → refusal names #23
  - comment by `NONE` association → absent from `comments`, `hiddenComments: 1`
  - issue author association `CONTRIBUTOR` → refusal
  - not on the project → refusal; closed issue → refusal
  - no parent → base `main`; parent `E5 · …` with no `epic/e5-*` head → base `main`
  - size `L` or label `security` → `needsApproval: true`; marker comment → `planApproved: true`
  - `slugify("¿?")` → `"issue"`; slug drops `a an and the with for of to in on`, keeps 4 words, max 40 chars
  - `branch.existsRemote` from heads, `existsLocal` from `localBranches`; an existing `*/24-*` branch is reused instead of a newly computed name
- [x] **Step 2: Run** `pnpm --filter @heat/config exec vitest run test/ticket.test.mjs` — expect FAIL (module missing).
- [x] **Step 3: Implement** `loadTicket` and helpers in `src/ticket.mjs`. Closing keyword regex: `/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi`, compared as numbers.
- [x] **Step 4: Run** the same command — expect PASS.
- [x] **Step 5: Commit** `feat(config): add ticket loader with the may-start rule (#24)`.

### Task 2: `appendRefinement` and `moveCard`

**Files:**

- Modify: `packages/config/src/ticket.mjs`
- Test: `packages/config/test/ticket.test.mjs`

**Interfaces:**

- Produces: `appendRefinement({ gh, repo, number, text, date }) -> { body }` — reads the body over REST, appends `\n\n---\n\n## Refined\n\n` plus text (heading only if the body has no `## Refined` line yet, otherwise `\n\n### Update <date>\n\n` plus text), writes with `issue edit --body-file -`, re-reads and throws `Original text changed` unless the old body is a prefix; then posts a log comment.
- Produces: `moveCard({ gh, repo, number, stage }) -> void`, `stage` is `"start"` (Status `In progress`, add `in-progress`, remove `needs-refinement`, `ready`) or `"review"` (Status `In review`). Option ids are read from the project's Status field by name; an unknown option throws.

- [x] **Step 1: Write the failing tests:** original body kept byte for byte (CRLF and trailing newline too); second refinement adds `### Update 2026-11-07` and no second `## Refined`; a fake `gh` that changes the body between write and re-read makes it throw; empty `text` throws; `moveCard` start makes exactly the label and item-edit calls above; `review` only sets Status; missing option `In review` throws.
- [x] **Step 2: Run** — expect FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run** — expect PASS, and `pnpm --filter @heat/config test:coverage` stays at or above 85%.
- [x] **Step 5: Commit** `feat(config): add append-only refinement and card moves (#24)`.

### Task 3: CLI `pnpm ticket`

**Files:**

- Create: `packages/config/bin/ticket.mjs`
- Modify: `packages/config/src/ticket.mjs` (add `parseCli`), root `package.json` (`"ticket": "node packages/config/bin/ticket.mjs"`)
- Test: `packages/config/test/ticket.test.mjs`

**Interfaces:**

- `pnpm ticket load <N>` prints the `Ticket` JSON; exit 0 when it may start, 3 when `refusals` is not empty.
- `pnpm ticket refine <N> --file <path>`; `pnpm ticket move <N> start|review`.
- `parseCli(argv) -> { command, number, file?, stage?, repo }`; rejects unknown commands, unknown flags, numbers that are not positive integers, and a `--repo` that fails the `github-setup.mjs` pattern (reuse `checkTarget` by exporting it).
- `bin` collects `localBranches` with `git for-each-ref --format=%(refname:short) refs/heads` and runs `gh` through `execFileSync` like `bin/github-setup.mjs`.

- [x] **Step 1: Failing tests** for `parseCli`: `["load","24"]` ok; `["load","24; rm"]`, `["load","-1"]`, `["load","0"]`, `["nuke","1"]`, `["move","1","merge"]`, `["refine","1"]` (no file) throw. Plus one spawn test running `bin/ticket.mjs` with no args → exit 1 and a usage line.
- [x] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [x] **Step 5: Commit** `feat(config): add pnpm ticket command (#24)`.

### Task 4: Agents and the skill

**Files:**

- Create: `.claude/agents/refiner.md`, `.claude/agents/reviewer.md`, `.claude/agents/security-reviewer.md`
- Create: `.claude/skills/implement-issue/SKILL.md`, `.claude/skills/implement-issue/references/pr-body.md`
- Test: `packages/config/test/skill.test.mjs`

**Interfaces:**

- Agents have frontmatter `name`, `description`, `tools`. Refiner and reviewers get read-only tools (`Read, Grep, Glob, Bash`) and return text; only the skill writes to GitHub, through `pnpm ticket`.
- Refiner returns the Refined text (decisions, refined acceptance criteria in Given/When/Then, edge cases, dependencies) and never the whole body.
- Reviewer and security reviewer return findings as `severity (Critical/Important/Minor) · file:line · rule heading from CLAUDE.md · problem · fix`, or "No findings".
- SKILL.md: one section per stage with its command, its artifact (plan section 12) and its stop conditions; resume table (which artifact means which stage is done); issue body and comments are wrapped as data; approval pause posts the plan comment and ends the turn; on approval posts the marker comment.

- [x] **Step 1: Failing test** `skill.test.mjs`: SKILL.md and each agent have `name` and `description` frontmatter and the name matches the file; SKILL.md is under 500 lines; every relative link resolves; SKILL.md mentions each agent by name and each `pnpm ticket` subcommand; SKILL.md names all eight stages in order; no file in `.claude/` contains `Co-Authored-By`, `--force`, `gh pr merge` other than in a "never" sentence (checked as: every such line also contains "never" or "Never").
- [x] **Step 2: Run** — FAIL. **Step 3: Write the agents and the skill**, following skill-creator guidance (description says when to trigger, explains the why, imperative). **Step 4: Run** — PASS, and `pnpm format:check` clean.
- [x] **Step 5: Commit** `feat: add implement-issue skill with refiner and review agents (#24)`.

### Task 5: Docs

**Files:**

- Modify: `CLAUDE.md` (Workflow stage 3 → `<type>/N-slug` from the epic branch when one exists; stage 1 → "blocked" rule in one line; reference the skill), `README.md` (one short `pnpm ticket` section beside `github:setup`).

- [x] **Step 1:** Edit; **Step 2:** `pnpm --filter @heat/config test` (docs guard: under 200 lines, no repeated sentence, links resolve) — PASS. **Step 3: Commit** `docs: point workflow at the implement-issue skill (#24)`.

### Task 6: Verify, review, dry runs, PR

- [ ] `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build` — all exit 0.
- [ ] Negative run: `pnpm ticket load <a blocked issue>` exits 3 and names the blocker; the skill stops at stage 1 with that reason.
- [ ] Reviewer and security reviewer agents on the branch diff; fix confirmed findings; re-run checks.
- [ ] Push, PR into `epic/e0-engineering-foundation` with `Closes #24`, test evidence and both reviews' findings; `pnpm ticket move 24 review`.
- [ ] P0 exit dry run: `/implement-issue <trivial ticket the owner picks>` end to end to a green PR, linked from this PR. Owner merges.
