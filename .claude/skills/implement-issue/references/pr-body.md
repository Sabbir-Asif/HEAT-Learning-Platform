# Pull request body

Follows `.github/pull_request_template.md`, with a Reviews section added. Fill every section; write "None" or "Not a UI change" rather than deleting one. Plain sentences, no marketing, nothing the reader cannot check. No attribution or "Generated with" lines are ever added.

Title: a conventional commit subject, for example `feat: add enrollment approval queue` or `chore: add implement-issue skill`.

```markdown
## Summary

What changed and why, in a few lines. Name the approach chosen in the plan and the files that matter.

## Linked issue

Closes #N (part of <epic code>, #<epic number>). Targets <base branch>.

## Test evidence

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm build`: <result>
- New and changed tests: <file: what they prove>
- Acceptance criteria: <each criterion, and the test or the manual check that shows it>
- Test plan from the issue: <each item and its result>

## Screenshots

Phone and laptop width, light and dark. Or "Not a UI change".

## Reviews

- Code review: <findings by severity, and for each: fixed in <commit> or answered with the reason>
- Security review: <same, or "Not run: not a security ticket and no security-relevant files touched">

## Security notes

Auth, permissions, uploads, personal data, secrets and dependencies touched, and how they are handled. Or "None".

## Checklist

- [ ] Acceptance criteria of the linked issue are met
- [ ] Tests added or updated, and `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:coverage` and `pnpm build` pass
- [ ] No secrets, environment files or personal data in the diff
- [ ] Docs or ADR updated where behaviour or a decision changed
- [ ] UI changes pass the UI review checklist in CLAUDE.md
- [ ] CI green
```

Tick only what is true when the pull request is opened. "CI green" stays unticked until the checks finish.
