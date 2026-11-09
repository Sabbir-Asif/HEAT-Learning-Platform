# Issue 40: Lighthouse CI with Slow 4G budgets, warning only

Approach: Lighthouse runs inside `@heat/e2e` (`packages/e2e/lighthouse`) against the production build served by `next start` on a fixed port, with no secrets, database or API. A pure module applies the budgets, a runner measures, a reporter turns the numbers into annotations and a job summary. The job never fails the run and is not a required check.

Decisions

- Measurement method for first-load JavaScript: the sum of `transferSize` of every Script request in Lighthouse's `network-requests` audit for the page load, as served with gzip by Next. It is measured the same way for public and learner pages. The player chunk is excluded for learner pages by a URL pattern in the config.
- LCP is the Lighthouse number under its mobile preset with simulated Slow 4G (150 ms RTT, 1.6 Mbps) and 4x CPU slowdown. Each page runs 3 times and the median is judged.
- `packages/e2e/lighthouse/config.json` holds budgets, run count, port and the audited pages. A later ticket adds one entry (path, kind, app, optional auth) and changes no workflow.
- Only `/` of `frontend-public` is audited now. The learner budget and the player-chunk rule are configured and unexercised.
- Reporting: `::warning` annotations, a job summary, and a `lighthouse-reports` artifact (HTML and JSON, 7 days) uploaded also when the run fails. A crashed or timed-out run becomes a warning. No PR comment, since workflows hold no write permission.
- Chromium comes from the Playwright install, cached like the `storybook` job.

Steps

1. Pure budget logic with unit tests in `packages/config/test/lighthouse.test.mjs`: median, script totals, player exclusion, evaluation, annotation and summary text.
2. Runner: start the server, run Lighthouse three times per page, write `lighthouse-results`.
3. Workflow job `lighthouse` and workflow tests: pinned actions, timeout, no path filter, not in branch protection, `continue-on-error`.
4. README: Development section.
5. Prove the warning path with a deliberate breach on a throwaway branch.
