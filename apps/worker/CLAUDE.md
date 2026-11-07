# worker

The same codebase as the API, started from a different entry point. It runs the BullMQ consumers (transcode, certificate, email, cleanup) and has no HTTP listener. Shared rules: [root CLAUDE.md](../../CLAUDE.md), including the worker isolation line under [Security](../../CLAUDE.md#security). This file adds only what is specific to the worker.

## Rules

- Import shared code only from `api/core`. Never import controllers, guards or other HTTP modules, and never open a port.
- FFmpeg and Chromium run here and nowhere else, so they never share a process with HTTP traffic.
- Make every job idempotent: the relay delivers at least once, and a retry must not send a second email or issue a second certificate.
- Email jobs store a copy of the recipient address and read their category budget from the quota counter. When a budget is used up or the provider reports a quota error, the job waits instead of failing.
- Pass ids in job data, not records, and load the current state when the job runs.
- The nightly insights rollup and the daily cleanup of unlinked uploads (after 24 hours) are scheduled here.
- Give each job a retry policy and a dead-letter outcome that an operator can see on the queue dashboard.
