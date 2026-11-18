# CI, GitHub setup and tickets

Required checks, branch protection, repository setup and the ticket command.

## Continuous integration

Pull requests and pushes to `main` run these checks in GitHub Actions; each is a required status check:

| Check                                          | Runs                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `lint`, `format`, `typecheck`, `test`, `build` | The matching root script through Turborepo (`test` runs coverage)    |
| `integration`                                  | `test:integration` in any package that defines it (Testcontainers)   |
| `audit`                                        | `pnpm audit:deps`, also weekly; fails on high or critical advisories |

The `migrations` job is separate and not yet a required check. On pull requests it fails when a migration directory that exists on the base branch is modified or deleted (`packages/config/bin/migrations.mjs immutable`, naming each file), then applies the migrations to an empty Postgres 17 service with `prisma migrate deploy` and fails when `prisma migrate diff` finds the schema differs. It is a quick pre-check for the drift test in `packages/db/test/integration/migrate.integration.test.ts`, which the required `integration` job also runs. Review rules for migrations are in [docs/runbooks/migration-review.md](docs/runbooks/migration-review.md). The owner adds `migrations` to `.github/branch-protection.json` and re-applies the protection.

The `api-client-drift` job is separate and not yet a required check either. It builds contracts and the API, regenerates `apps/api/openapi.json` and `packages/api-client/src/generated/`, and fails when any file differs from what is committed (modified, deleted or new), listing the files. Run `pnpm generate` and commit the result to fix it.

Dependabot runs from `.github/dependabot.yml` and bumps SHA-pinned actions without needing a version comment (npm, GitHub Actions and the dev compose images; app Dockerfiles are added with the deployment tickets). CodeQL is left out: GitHub only stores its results for a private repository with code security enabled. Add it back if the repository goes public or code security is bought. In CI, Turborepo's cache lives in `.turbo` and is restored per task, so unchanged packages replay instead of re-running.

Workflow rules, enforced by `packages/config/test/workflows.test.mjs`: every external action is pinned to a commit SHA with no trailing version comment (comments are not allowed in workflow files), each workflow sets `permissions`, and `pull_request_target` is not used.

**Audit ignore list.** To accept an advisory you cannot fix yet, add `{ "advisory": "GHSA-...", "reason": "...", "expires": "YYYY-MM-DD" }` to `.github/audit-ignore.json`. A reason is required, the expiry is at most 90 days out, and an expired entry fails the audit.

**Branch protection.** `main` requires the checks above, linear history (merge with squash or rebase), and blocks force pushes and deletions. Changes go through a pull request, but no approval is required; only the owner merges. Apply or re-apply it with:

```sh
gh api -X PUT repos/Sabbir-Asif/HEAT-Learning-Platform/branches/main/protection --input .github/branch-protection.json
```

## GitHub setup

Issue forms (feature, bug, spike, chore) are in `.github/ISSUE_TEMPLATE/` and the pull request template is `.github/pull_request_template.md`. Labels, milestones and the "HEAT LMS" Project with its fields are kept in `packages/config/src/github-setup.mjs` and applied with the `gh` CLI:

```sh
pnpm github:setup --dry-run   # print the planned changes, make none
pnpm github:setup             # apply them
```

Run the dry run first. It reads only, but it still needs a token that can read this private repository and the Project. The owner of the Project is a user account, which GitHub's fine-grained tokens cannot reach, so use the `gh auth login` token or a classic one:

| Run         | Scopes                                                                          |
| ----------- | ------------------------------------------------------------------------------- |
| `--dry-run` | `repo` and `read:project`                                                       |
| apply       | `repo` and `project` (`gh auth refresh -s project` adds it to a signed-in `gh`) |

It is safe to re-run. It creates what is missing, updates a label's colour and description in place, and never touches issues or project items. It does not delete or rename anything. Extra labels, milestones and options are left alone, and a closed project with the same title is reported instead of duplicated. Adding an option to an existing project field is the one risky write, because the API replaces the whole option list. The script reads the options twice and writes nothing if they changed, prints the current list first so it can be restored, passes every existing option back with its id, and reads the field again afterwards, failing if any option id or name is missing. It exits non-zero when something needs a person, such as a field of the wrong type. The Project Area options are the `area:*` labels, from one list in the script. `packages/config/test/github-setup.test.mjs` tests it against a fake `gh`, with no network or credentials.

## Ticket command

`pnpm ticket` is the GitHub side of the `/implement-issue` skill (`.claude/skills/implement-issue/`), kept in `packages/config/src/ticket.mjs` so the workflow rules are tested code:

```sh
pnpm ticket load 24                          # ticket JSON; exit 3 with the reasons when it may not start
pnpm ticket refine 24 --file refined.md      # append to the issue's "Refined" section and log it
pnpm ticket move 24 start                    # card to In progress, labels set (review: In review)
```

It needs `gh` with the `repo` and `project` scopes. `load` only reads, and keeps only comments from repository collaborators. `refine` never rewrites the owner's text: it appends, reads the body again just before writing and stops if it changed, then reads it back and fails if it is not exactly what was written. GitHub has no compare-and-swap for issue bodies, so an edit in the moment between that last read and the write can still be lost. `packages/config/test/ticket.test.mjs` tests it against a fake `gh`; `packages/config/test/skill.test.mjs` checks the skill and its agents.
