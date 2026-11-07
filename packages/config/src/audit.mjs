/** Severities that fail the dependency audit. */
export const BLOCKING_SEVERITIES = ["high", "critical"];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_IGNORE_DAYS = 90;

/**
 * @typedef {object} AuditIgnore
 * @property {string} advisory GitHub advisory id, for example GHSA-xxxx-xxxx-xxxx.
 * @property {string} reason Why the advisory does not apply or cannot be fixed yet.
 * @property {string} expires Last day the ignore holds, as YYYY-MM-DD.
 */

/**
 * Checks `pnpm audit --json` output against the ignore list.
 * An ignore needs a reason and an expiry no more than 90 days out; an expired ignore fails the audit.
 *
 * @param {{ advisories?: Record<string, { github_advisory_id: string, severity: string, module_name: string, title: string }> }} report
 * @param {AuditIgnore[]} ignores
 * @param {Date} today
 * @returns {string[]} Human-readable failures; empty when the audit passes.
 */
export function evaluateAudit(report, ignores, today) {
  const failures = [];
  const active = new Set();
  const day = today.toISOString().slice(0, 10);
  const limit = new Date(today.getTime() + MAX_IGNORE_DAYS * MS_PER_DAY).toISOString().slice(0, 10);

  for (const ignore of ignores) {
    const label = `Ignore ${ignore.advisory ?? "(no advisory id)"}`;
    if (!ignore.advisory) failures.push(`${label}: missing advisory id`);
    else if (!ignore.reason?.trim()) failures.push(`${label}: missing reason`);
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(ignore.expires ?? "")) {
      failures.push(`${label}: expires must be a YYYY-MM-DD date`);
    } else if (ignore.expires < day) failures.push(`${label}: expired on ${ignore.expires}`);
    else if (ignore.expires > limit) {
      failures.push(`${label}: expires ${ignore.expires}, more than ${MAX_IGNORE_DAYS} days out`);
    } else active.add(ignore.advisory);
  }

  for (const advisory of Object.values(report.advisories ?? {})) {
    if (!BLOCKING_SEVERITIES.includes(advisory.severity)) continue;
    if (active.has(advisory.github_advisory_id)) continue;
    failures.push(
      `${advisory.severity} ${advisory.github_advisory_id}: ${advisory.module_name}, ${advisory.title}`,
    );
  }
  return failures;
}
