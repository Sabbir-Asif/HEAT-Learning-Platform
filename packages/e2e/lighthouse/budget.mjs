import { readFileSync } from "node:fs";

export const config = JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8"));

const bytesPerKb = 1024;
const title = "Lighthouse budget";

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function scriptBytes(scripts, { playerChunkPattern, allowsPlayer }) {
  const player = new RegExp(playerChunkPattern);
  let countedBytes = 0;
  const playerUrls = [];
  for (const { url, transferSize } of scripts) {
    const isPlayer = player.test(url);
    if (isPlayer) playerUrls.push(url);
    if (isPlayer && allowsPlayer) continue;
    if (typeof transferSize === "number") countedBytes += transferSize;
  }
  return { countedBytes, playerUrls };
}

const kilobytes = (bytes) => (bytes / bytesPerKb).toFixed(1);
const seconds = (ms) => (ms / 1000).toFixed(1);

export function evaluatePage(page, settings) {
  const { path, kind, allowsPlayer = false, runs } = page;
  if (runs.length === 0) {
    return {
      path,
      kind,
      firstLoadKb: null,
      lcpMs: null,
      findings: [`${path} has no completed Lighthouse run`],
    };
  }
  const measured = runs.map((entry) =>
    scriptBytes(entry.scripts, {
      playerChunkPattern: settings.playerChunkPattern,
      allowsPlayer,
    }),
  );
  const firstLoadBytes = median(measured.map(({ countedBytes }) => countedBytes));
  const lcpMs = median(runs.map(({ lcpMs: value }) => value).filter((value) => value !== null));
  const firstLoadKb = firstLoadBytes / bytesPerKb;
  const budgetKb = settings.budgets[kind].firstLoadScriptKb;
  const findings = [];
  if (firstLoadKb > budgetKb) {
    findings.push(
      `${path} first-load JS is ${kilobytes(firstLoadBytes)} KB gzipped, budget ${budgetKb} KB`,
    );
  }
  if (lcpMs === null) {
    findings.push(`${path} LCP could not be measured`);
  } else if (lcpMs > settings.lcpBudgetMs) {
    findings.push(
      `${path} LCP is ${seconds(lcpMs)} s on Slow 4G mobile, budget ${seconds(settings.lcpBudgetMs)} s`,
    );
  }
  if (!allowsPlayer) {
    const urls = new Set(measured.flatMap(({ playerUrls }) => playerUrls));
    for (const url of urls) {
      findings.push(`${path} requested the player chunk ${url}, which only lesson pages may load`);
    }
  }
  return { path, kind, firstLoadKb, lcpMs, findings };
}

export function report(results, { outcome, artifactUrl }) {
  const evaluated = results ? results.pages.map((page) => evaluatePage(page, config)) : [];
  const annotations = evaluated.flatMap(({ findings }) =>
    findings.map((finding) => `::warning title=${title}::${finding}`),
  );
  if (!results || outcome !== "success") {
    annotations.unshift(
      "::warning title=Lighthouse run did not finish::The Lighthouse run failed or timed out before every page was audited. Check the job log.",
    );
  }
  const lines = ["## Lighthouse budgets", ""];
  if (!results) {
    lines.push("The run did not finish and produced no results.");
  } else {
    lines.push(
      "| Page | Kind | First-load JS (gzipped) | LCP |",
      "| --- | --- | --- | --- |",
      ...evaluated.map(
        ({ path, kind, firstLoadKb, lcpMs }) =>
          `| ${path} | ${kind} | ${firstLoadKb === null ? "n/a" : `${firstLoadKb.toFixed(1)} KB`} | ${lcpMs === null ? "n/a" : `${seconds(lcpMs)} s`} |`,
      ),
    );
    const findings = evaluated.flatMap(({ findings: list }) => list);
    lines.push(
      "",
      findings.length > 0
        ? findings.map((f) => `- ${f}`).join("\n")
        : "All pages are inside their budgets.",
    );
    if (outcome !== "success") lines.push("", "The run did not finish; the table may be partial.");
  }
  lines.push(
    "",
    `Budgets: first-load JS ${config.budgets.public.firstLoadScriptKb} KB for public pages and ${config.budgets.learner.firstLoadScriptKb} KB for learner pages excluding the player, LCP ${seconds(config.lcpBudgetMs)} s. Median of ${config.runs} runs on mobile with Slow 4G and 4x CPU slowdown. First-load JS is the transfer size of every script request on first load.`,
    artifactUrl
      ? `HTML and JSON reports: ${artifactUrl}`
      : "HTML and JSON reports are in the `lighthouse-reports` artifact.",
    "This check never blocks a merge.",
    "",
  );
  return { annotations, summary: lines.join("\n") };
}
