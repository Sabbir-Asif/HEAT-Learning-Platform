export const BLOCKING_SEVERITIES = ["high", "critical"];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_IGNORE_DAYS = 90;

const isDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(value).toISOString().slice(0, 10) === value;

export function evaluateAudit(report, ignores, today) {
  if (report?.error || typeof report?.advisories !== "object" || !report.advisories) {
    const detail = report?.error ? JSON.stringify(report.error) : "no advisories field";
    return [`pnpm audit did not return a usable report: ${detail}`];
  }
  const failures = [];
  const active = new Set();
  const day = today.toISOString().slice(0, 10);
  const limit = new Date(today.getTime() + MAX_IGNORE_DAYS * MS_PER_DAY).toISOString().slice(0, 10);

  for (const ignore of ignores) {
    const label = `Ignore ${ignore.advisory ?? "(no advisory id)"}`;
    if (!ignore.advisory) failures.push(`${label}: missing advisory id`);
    else if (!ignore.reason?.trim()) failures.push(`${label}: missing reason`);
    else if (!isDate(ignore.expires)) {
      failures.push(`${label}: expires must be a YYYY-MM-DD date`);
    } else if (ignore.expires < day) failures.push(`${label}: expired on ${ignore.expires}`);
    else if (ignore.expires > limit) {
      failures.push(`${label}: expires ${ignore.expires}, more than ${MAX_IGNORE_DAYS} days out`);
    } else active.add(ignore.advisory);
  }

  for (const advisory of Object.values(report.advisories)) {
    if (!BLOCKING_SEVERITIES.includes(advisory.severity)) continue;
    if (active.has(advisory.github_advisory_id)) continue;
    failures.push(
      `${advisory.severity} ${advisory.github_advisory_id}: ${advisory.module_name}, ${advisory.title}`,
    );
  }
  return failures;
}
