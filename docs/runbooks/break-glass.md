# Break-glass super admin recovery

## When to use

The super admin can no longer sign in (forgotten password, lost access) and no other route back exists. Access to this command equals shell access on the server, so it is the last resort and every use is audited.

## Command

Run from a shell on the server, in the API container or install, with the API environment loaded (database, Redis and auth secrets):

```sh
pnpm --filter api recover-super-admin
node dist/cli/main.js recover-super-admin
node dist/cli/main.js recover-super-admin --email root@example.test
```

Without `--email` the command needs exactly one super admin. It refuses with a non-zero exit and changes nothing when there is none, when several exist (pass `--email`), or when the account is deactivated.

## What it does

- Generates a one-time temporary password from a CSPRNG and prints it once to the terminal. It is never logged or written to a file.
- Stores its argon2id hash and sets `mustChangePassword`, in one transaction with an audit entry (`admin.break-glass.recover`) that records the time and the host name.
- Revokes every session of that account, so old sessions fail to refresh.

## After

1. Sign in at the admin console with the temporary password and set a new password when asked.
2. Clear the terminal scrollback and do not paste the password anywhere. Prefix the command with a space or disable history if the shell records commands (the password is printed, not typed, so history holds only the command).
3. Check the audit log for the `admin.break-glass.recover` entry and confirm it matches your own use. An entry you did not make means shell access was abused: rotate secrets and review the server.
4. If sign-in answers "too many attempts", the sign-in lockout from earlier failures is still running (it is capped); wait for it to lapse.

## Security notes

- There is no HTTP route for this command; a test enumerates the routes to keep it that way.
- The command prints the password to stdout only. Do not run it through a pipe that stores output, such as a logging wrapper or CI job.
- The seed never resets an existing super admin, in any environment, so deploys cannot undo or trigger a recovery.
