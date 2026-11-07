# Workflow hooks implementation plan (#25)

**Goal:** Eight Claude Code hooks that keep an agent session on the rails of the workflow: context loader, ticket injector, branch guard, plan gate, danger guard, PR gate, formatter and stop check, plus the `permissions.deny` rules and a `pnpm verify` script that the PR gate relies on. Hooks are guard rails; CI and branch protection stay the gate (ADR 0010).

**Spec:** issue #25 including its `## Refined` section and the team lead decisions in it; plan sections 02 (D10), 12 and 14; ADR 0010.

## Confirmed hook contracts

Checked on 2026-11-08 against the Claude Code hooks reference (code.claude.com/docs/en/hooks) and the settings and permissions reference. These fix the interfaces below.

- Settings shape: `hooks.<Event>[] = { matcher?, hooks: [{ type: "command", command, timeout, onFailure? }] }`. `timeout` is in seconds. `UserPromptSubmit` and `Stop` take no matcher. SessionStart matchers are `startup`, `resume`, `clear`, `compact` (and `fork`). Tool matchers are regexes on the tool name (`Edit|Write`, `Bash`). The command runs through a shell and gets `$CLAUDE_PROJECT_DIR`.
- `onFailure: "block"` on a `command` hook for `UserPromptSubmit`, `PreToolUse` and `PermissionRequest` blocks the action when the hook fails or times out. Without it, exit 1, a crash or a timeout on PreToolUse is non-blocking and the call goes ahead. The four guards set it and also fail closed in their own code.
- Common input on stdin: `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `permission_mode`.
  - PreToolUse: `tool_name`, `tool_input`, `tool_use_id`. Write: `file_path`, `content`. Edit: `file_path`, `old_string`, `new_string`, `replace_all`. Read: `file_path`, `offset`, `limit`. Grep: `pattern`, `path`, `glob`. Bash: `command`, `description`, `timeout`, `run_in_background`. Glob: `pattern`, `path`. NotebookEdit: `notebook_path` (the docs list Edit and Write fields only; the rest is read defensively).
  - PostToolUse: the same plus `tool_response` (Write: `{ filePath, type }`) and `duration_ms`.
  - UserPromptSubmit: `prompt`. SessionStart: `source`. Stop: `stop_hook_active`, `last_assistant_message`.
- Output: exit 0 plus JSON on stdout, or exit 2 with the reason on stderr. PreToolUse blocks with exit 2 or `{ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason } }`; `additionalContext` is also allowed inside `hookSpecificOutput`. Allowing is silence: the hooks never print `permissionDecision: "allow"`, which would skip the permission flow. PostToolUse feeds text back with `hookSpecificOutput.additionalContext`. Stop continues the turn with top-level `{ decision: "block", reason }`; exit 2 does the same. UserPromptSubmit and SessionStart add plain stdout, or `hookSpecificOutput.additionalContext`, as context. Hook output strings are capped at 10,000 characters, so the injector stays under 9,500.
- `permissions.deny`: gitignore-style paths for `Read(...)` and `Edit(...)` (Edit covers Write), bare names match at any depth, `!` negation carves exceptions inside the same file (`Read(!.env.example)`). Read rules also cover Grep and Glob. `Bash(git push *)` is a wildcard match per sub-command; wrapper spellings are not matched, so the Bash hook stays the real check.
- Hooks load from the project of the session's cwd. Not documented, and so not relied on: whether subagent tool calls fire PreToolUse, and whether the input names a subagent. The design does not depend on either.

## Approach and why

All logic is Node built-ins only in `packages/config/src/hooks/*.mjs`, so it runs before `pnpm install` and is covered by the `@heat/config` coverage gate. `packages/config/bin/hook.mjs <name>` is a thin runner: it reads stdin, calls the hook, prints the JSON, exits. `.claude/settings.json` calls `node "$CLAUDE_PROJECT_DIR/packages/config/bin/hook.mjs" <name>`.

- Hooks are pure functions `(input, deps) -> result`, with the filesystem, `git`, `gh` and the clock behind `deps`. In-process tests give the coverage; one child-process test per hook (allow and block) runs the real bin against a throwaway git repo and worktree in `os.tmpdir()`, with a fake `gh` and `pnpm` on `PATH`.
- Repo and branch come from the target, never the session `cwd` (the skill works in worktrees from the main checkout). Edit and Write resolve the repo from the file; Bash resolves it from the command text (`cd`, `git -C`, `gh pr create --head`), falling back to the input `cwd`. Paths are resolved to real paths on both sides.
- Bash commands are tokenised (quotes, heredocs, `&&`, `;`, `|`, `$()`, backticks, `env X=1`, `bash -c`) and each simple command is checked; no single regex over the whole line.
- Guards (branch guard, plan gate, danger guard, PR gate) fail closed: malformed or empty input, or a crash, denies. The other four fail open with a one-line note.
- Alternatives rejected: a bash/bats script per hook (not covered, not linted, harder to tokenise safely); a marker file written by the agent (the verify script writes it, once, after the five checks pass); matching the whole command with one regex (misses `git -C x push --force`, false-positives on commit messages).

## Files

Create under `packages/config`:

- `bin/hook.mjs`, `bin/verify.mjs`
- `src/hooks/run.mjs`, `paths.mjs`, `git.mjs`, `shell.mjs`, `env-files.mjs`, `edit-guards.mjs` (branch guard and plan gate), `danger-guard.mjs`, `marker.mjs`, `pr-gate.mjs`, `state.mjs`, `stop-check.mjs`, `context-loader.mjs`, `injector.mjs`, `formatter.mjs`
- `src/verify.mjs`
- `test/hooks/*.test.mjs` mirroring the above, `test/verify.test.mjs`, `test/settings.test.mjs`, `test/fixtures/repo.mjs`

Change: `src/ticket.mjs` (export the collaborator set, no behaviour change), root `package.json` (`verify` script), `.claude/skills/implement-issue/SKILL.md` (stage 6 calls `pnpm verify`), `.github/CODEOWNERS`, `README.md`. Create last: `.claude/settings.json`.

## Tasks

Each task is test first: write the failing test, run `pnpm --filter @heat/config exec vitest run <file>` and see it fail for the expected reason, write the least code, see it pass, tick the box and commit with `chore(config): <summary> (#25)`.

### Group A: runner, settings and the four guards

- [x] **A1 Shared helpers and runner.** `fixtures/repo.mjs` (throwaway repo with an initial commit, worktrees, fake `origin` refs), `paths.mjs` (real path of the nearest existing ancestor plus the rest, `..` and symlinks), `git.mjs` (`repoOf(path)`, `branchOf(top)`, `ticketNumber(branch)`, `worktreeFor(branch)`, `existsInBase(top, relPath)`), `run.mjs` and `bin/hook.mjs`. Tests: unknown hook name, empty and malformed stdin and a thrown error deny for guards and allow with a note for the others; deny prints the PreToolUse JSON; a non-repo path resolves to no repo; `/tmp` and `/var` resolve under `/private`.
- [x] **A2 Branch guard.** Blocks on `main`, `master`, detached HEAD in the file's own repo; a worktree on a feature branch is allowed even when the session cwd is on `main`; outside any repo and non-existing directories are allowed; `NotebookEdit` `notebook_path`.
- [x] **A3 Plan gate.** `<type>/N-slug` without `docs/plans/issue-N.md` blocks any other file in that worktree and names the missing path; the plan file itself is allowed; with the plan present it allows; `epic/*` and other branches allow with a note; the hook files themselves are editable once the plan exists.
- [x] **A4 Tokeniser.** `shell.mjs`: quotes, escapes, heredoc bodies skipped, separators, `$()` and backtick recursion, `env`/assignment/`command`/`sudo`/`nohup`/`time` wrappers stripped, `bash -c`/`eval` bodies recursed, redirections returned as targets, `cd X &&` tracking for the working directory.
- [x] **A5 Env files.** `env-files.mjs`: `.env`, `.env.*`, `*.env`, `.envrc`, case-insensitive, `.env.example` readable. Danger guard denies Read, Grep (`path`, `glob`), Glob, Edit, Write, and Bash readers (`cat`, `less`, `head`, `source`, `.`, `rg`, `grep`, `cp`, `base64`, `<` redirects, `$(cat .env)`) and allows `git add`, `ls`, `.env.example`, a commit message that mentions `.env`.
- [ ] **A6 Danger guard, git and prisma.** Force pushes in every form (`--force`, `-f`, `-fu`, `--force-with-lease`, `--force-if-includes`, `+refspec`, `--mirror`, `git -C p push`, compound commands, `env X=1 git push -f`); `prisma migrate reset` via `pnpm`, `pnpm exec`, `pnpm --filter x exec`, `npx`; `pnpm dev:reset`, `git push -u origin branch` and `git push --follow-tags` are allowed.
- [ ] **A7 Danger guard, migrations and shell writes.** Edit, Write and shell writes to a migration present in `origin/main` or `origin/epic/*` are blocked while one created on the branch is editable; shell writes into the repo (`>`, `>>`, `tee`, `sed -i`, `perl -i`, `cp`, `mv`, `rm`, `dd of=`, `install`, `eval`/`bash -c`) are blocked on `main` and on a ticket branch without its plan, allowed outside the repo, to `/dev/null`, to `$SCRATCH`/`${SCRATCH}`; any other unexpanded variable target is blocked with a message to use the Write tool. The skill's normal commands are all allowed (test table below).
- [ ] **A8 Child-process tests for A2 to A7** (allow and block case each) through `bin/hook.mjs`.

Normal commands that must stay allowed (test table in A7): `pnpm install --frozen-lockfile`, `pnpm ticket move 25 start`, `node packages/config/bin/ticket.mjs load 25 > "$SCRATCH/ticket-25.json"`, `git fetch origin`, `git worktree add -b chore/25-x ../heat-lp-25 origin/epic/e0`, `git -C ../heat-lp-25 branch --unset-upstream`, `git add -A && git commit -m "docs: add plan (#25)"`, `git push -u origin chore/25-x`, `pnpm lint`, `pnpm generate`, `pnpm format`, `pnpm dev:reset`, `gh issue comment 25 --body-file "$SCRATCH/plan.md"`, `rg "prisma migrate reset" docs`, `git commit` with `.env` and `--force` in the message.

### Group B: marker, PR gate, stop check

- [ ] **B1 Marker and `pnpm verify`.** `marker.mjs` stores the HEAD sha in `<git dir>/heat-verified` (per worktree, never committed); valid when it equals HEAD and the tree is clean. `src/verify.mjs` runs lint, format:check, typecheck, test:coverage, build in order, stops at the first failure without writing, refuses a dirty tree, writes the marker only when all five pass. Root script `"verify": "node packages/config/bin/verify.mjs"`. Tests: pass, fail at step three, dirty tree, a commit after the marker invalidates it, child process with a fake `pnpm`.
- [ ] **B2 PR gate.** `gh pr create` at command position and `gh api` with a `pulls` path and a write method (`-X POST|PATCH|PUT`, `--method`, `-f`/`-F`/`--input`) are blocked without a valid marker in the right worktree (`--head <branch>` mapped through `git worktree list --porcelain`, otherwise cd or cwd); allowed with it; a commit after the marker re-blocks; the text `gh pr create` in a commit message, heredoc, `echo` or `rg` argument does not block; `gh pr view`, `gh api repos/o/r/pulls/1` (GET) allowed.
- [ ] **B3 State and stop check.** `state.mjs` keeps `{ worktree, typedDirty, blocks }` per session in `$HEAT_HOOKS_STATE_DIR` or `os.tmpdir()/heat-hooks` (outside any working tree). Stop check: `stop_hook_active` is honoured first (no block); typecheck is `pnpm typecheck` in the recorded worktree with a timeout; a failure blocks with the output tail through `{ decision: "block", reason }`; the counter caps blocks at 3 and resets on a pass; skipped when nothing typed changed, when the uncommitted changes are only under `test/` or `*.test.*`, or when only the committed plan changed; missing worktree or timeout fails open with a note.

### Group C: loader, injector, formatter

- [ ] **C1 Context loader.** Branch, issue number, plan path, exists or not, ticked of total checkboxes, reminder to check approval on the issue, Asia/Dhaka date; "no ticket branch" on `main` and epic branches; no network.
- [ ] **C2 Ticket injector.** Export `collaborators` from `ticket.mjs` and use it. `#N` extraction (not in words, URLs, colour codes or headings; 1 to 5 digits; at most 3), `gh api` through `execFile` with a 10 s timeout, body and comments from OWNER, MEMBER and COLLABORATOR only, a body by an outsider left out, count of omitted comments, delimiter block labelled untrusted data with a nonce, closing delimiter and tag-like text neutralised and every line prefixed, size cap, pull request numbers, missing issue, missing or failing `gh` add one note and never block, `/implement-issue 25` does not trigger. It also resets the session's stop counter.
- [ ] **C3 Formatter.** Records the edit in the state first, then runs Prettier and ESLint fixes from the package directory with the same ignore files as `format:check` and `lint`; skips generated files, `docs/`, images, ignored files and missing `node_modules` with a one-line note; unfixable ESLint output returns as `additionalContext`; a file outside any repo is untouched.
- [ ] **C4 Child-process tests for B2, B3, C1 to C3.**

### Group D: wiring

- [ ] **D1 CODEOWNERS** entries for `.claude/settings.json`, `packages/config/src/hooks/`, `packages/config/bin/hook.mjs` (and `bin/verify.mjs`, `src/verify.mjs`), with a test.
- [ ] **D2 SKILL.md stage 6** runs `pnpm verify` after the check list; `skill.test.mjs` stays green.
- [ ] **D3 README** hooks section: what each hook does, how the marker works, that the plan gate lets hook code be edited once the plan exists, and that hooks are guard rails while CI is the gate.
- [ ] **D4 `.claude/settings.json`** (created last): hooks, `permissions.deny` for `.env` (`Read`, `Edit`), `onFailure: "block"` on the guards, timeouts. `settings.test.mjs` checks every command points to an existing hook name, the schema shape, and runs each deny rule against the skill's normal paths for false positives.

## Acceptance criteria mapped to checks

| Criterion                                           | Proof                                                |
| --------------------------------------------------- | ---------------------------------------------------- |
| Edit on `main` blocked with a message               | A2, A8                                               |
| Feature branch without plan blocks source, plan ok  | A3, A8                                               |
| `git push --force`, `prisma migrate reset` blocked  | A6, A8                                               |
| `.env` read blocked through any tool                | A5, A8, D4 deny rules                                |
| No marker newer than the last commit blocks PR      | B1, B2, C4                                           |
| Typecheck failure does not loop                     | B3 (`stop_hook_active`, counter of 3)                |
| Non-collaborator comment not injected               | C2                                                   |
| Edited file formatted by Prettier and ESLint        | C3, C4                                               |
| Fail closed and fail open, crash and empty input    | A1 and per hook                                      |
| CODEOWNERS entries                                  | D1                                                   |

## Verification (stage 6)

```sh
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build
pnpm audit:deps
```

Manual smoke test: pipe sample hook JSON into `node packages/config/bin/hook.mjs <name>` for an allow and a block case of each hook and log the output lines. The ticket's dry run with hooks on happens after merge in a new session, because a hook change only takes effect in a session started in a checkout that holds it.
