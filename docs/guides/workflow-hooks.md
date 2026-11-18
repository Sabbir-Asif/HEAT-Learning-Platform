# Workflow hooks

The Claude Code hooks that guard an agent session.

## Workflow hooks

`.claude/settings.json` wires seven Claude Code hooks to `node packages/config/bin/hook.mjs <name>`. The logic is in `packages/config/src/hooks/` (Node built-ins only, so it runs before `pnpm install`) and is tested with throwaway git repos, worktrees and a fake `gh`, with no network. The hooks are guard rails for an agent session; branch protection and CI stay the gate (ADR 0010), because a hook can be bypassed through another tool.

| Hook              | Event                     | What it does                                                                                                                                                                                   |
| ----------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context-loader`  | SessionStart              | Prints the branch, issue number, offline. On `main` and epic branches it lists the ticket worktrees to resume.                                                                                 |
| `ticket-injector` | UserPromptSubmit          | For `#N` in a prompt, adds the issue body and the owner, member and collaborator comments as delimited untrusted data. Never blocks the prompt.                                                |
| `branch-guard`    | PreToolUse Edit, Write    | Blocks edits in a checkout on `main`, `master` or a detached HEAD. The repo is taken from the file, not from the session directory.                                                            |
| `danger-guard`    | PreToolUse Bash and files | Blocks force pushes, `prisma migrate reset`, edits to migrations already on `origin/main` or `origin/epic/*`, shell writes that skip the edit guards, and every read or write of `.env` files. |
| `pr-gate`         | PreToolUse Bash           | Blocks `gh pr create`, `gh pr new` and pull request creation through the API unless the verification marker matches `HEAD` on a clean tree.                                                    |
| `formatter`       | PostToolUse Edit, Write   | Runs ESLint fixes and Prettier on the touched file with the ignore files of `lint` and `format:check`. Skips `docs/`, generated files and images.                                              |
| `stop-check`      | Stop                      | Runs `pnpm typecheck` in the last edited worktree after typed files changed, at most 3 blocks per session, never twice in one turn.                                                            |

The four guards fail closed: malformed input, a crash or a timeout denies. The other four fail open with a one-line note.

`pnpm verify` runs lint, format check, typecheck, coverage tests and build in order and, only if all pass on a clean tree, writes the commit sha to `heat-verified` in the worktree's own git directory (never committed). The PR gate accepts a marker only when it equals `HEAD` and the tree is clean, so any later commit needs another `pnpm verify`. Stage 6 of the skill calls it.

Hook state for the stop check lives in `$HEAT_HOOKS_STATE_DIR` or a private `heat-hooks-<uid>/` directory (mode 0700, owner checked, never a symlink) under the system temp directory, outside every working tree. `.github/CODEOWNERS` makes the owner read every change to them. A change to a hook takes effect in sessions started in a checkout that contains it.

`.env` files are also denied by `permissions.deny` for Read and Edit. `.env.example` stays readable.

A glob in a Bash word is denied if it could match an env file name (the text before the first glob character plus `.env` or `.envrc`), so `cat .e*` and `cat prod*` are denied. The one exception is a listing of the real directory, which is trusted only when every condition holds:

- every command in the line is a plain reader from a short allow-list (`cat`, `head`, `tail`, `tac`, `nl`, `less`, `more`, `wc`, `od`, `xxd`, `strings`, `base64`, `md5sum`, `shasum`, `sha256sum`, plus the harmless `echo`, `pwd`, `true`, `ls`, `stat`, `file`, `cmp`), so any other program, `grep`, `diff`, `cd`, a package script or a writer withdraws the trust;
- the line is straight-line: separators are `;` and newline (plus `for NAME in words; do ...; done`), with no `&&`, `||`, `|`, `&`, subshell, group, function, `$(`, backtick, keyword block, wrapper such as `env` or `xargs`, or command whose name is a variable;
- no redirect writes anywhere except to `/dev/null`, `/dev/stdout`, `/dev/stderr` or `/dev/fd/N` (after normalising the path);
- the text has no assignment word (`NAME=`), `export`, `declare`, `typeset`, `unset`, `local`, `readonly` or `HOME`;
- the glob has no `**`, is not under a `~` path, has no `..` after a symlinked directory, and has no directory segment that starts with `.` or `[` and could match `.` or `..` (`.*/`, `.?/`), because some shells expand those.

Then brace lists are expanded, directory parts are listed on disk, every entry is tested including hidden ones and symlink targets, and any entry whose name starts with `.env` counts as an env file, and `cat foo*`, `cat docs/adr/0013*` and `wc -l docs/adr/*` are allowed unless an entry is an env file. `cat *` is denied when one is present. `find`, `rg`, `git`, `tar` and every other program use the name check, so `rg foo docs/adr/0013*` is denied. The listing assumes default shell glob options.

What the hooks cannot do. They cannot protect themselves: an agent that edits `.claude/settings.json` or the hook code changes the guards for later sessions, so `.github/CODEOWNERS` (the hook code, `ticket.mjs`, the skill, the agents and every `CLAUDE.md`) and CI are the backstop, and the owner reads those diffs. Writes under `.git`, to any `heat-verified` file and to `.claude/settings.local.json` are denied from every tool. Reads of `.env` files are denied by name; indirection such as variables, globs, interpreters or computed strings can get around the Bash check, which is a limit of reading command text, not something a hook can close. If `node` or `packages/config/bin/hook.mjs` is missing, every guarded tool call is blocked because the guards fail closed; restore the branch, or restart the session from a checkout that has the file.
