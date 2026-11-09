import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { evaluatePage, median, report, scriptBytes } from "../../e2e/lighthouse/budget.mjs";

const root = resolve(import.meta.dirname, "../../..");
const config = JSON.parse(
  readFileSync(resolve(root, "packages/e2e/lighthouse/config.json"), "utf8"),
);
const kb = (n) => n * 1024;
const script = (url, kilobytes) => ({ url, transferSize: kb(kilobytes) });
const run = (lcpMs, ...scripts) => ({ lcpMs, scripts });
const page = (overrides) => ({
  path: "/",
  kind: "public",
  allowsPlayer: false,
  runs: [run(1800, script("http://localhost:3000/a.js", 100))],
  ...overrides,
});

describe("config", () => {
  test("carries the owner budgets", () => {
    expect(config.budgets.public.firstLoadScriptKb).toBe(150);
    expect(config.budgets.learner.firstLoadScriptKb).toBe(200);
    expect(config.lcpBudgetMs).toBe(2500);
    expect(config.runs).toBe(3);
  });

  test("audits the public landing page as a single URL", () => {
    expect(config.pages).toEqual([{ path: "/", kind: "public", app: "frontend-public" }]);
  });

  test("every page has a path, a known kind and an app", () => {
    for (const entry of config.pages) {
      expect(entry.path).toMatch(/^\//);
      expect(Object.keys(config.budgets)).toContain(entry.kind);
      expect(entry.app).toMatch(/^frontend-/);
    }
  });
});

describe("median", () => {
  test("picks the middle of an odd list regardless of order", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  test("averages the middle pair of an even list", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  test("is null for nothing", () => {
    expect(median([])).toBeNull();
  });
});

describe("scriptBytes", () => {
  const scripts = [script("http://x/a.js", 10), script("http://x/player-abc.js", 40)];

  test("sums every script when nothing is excluded", () => {
    expect(scriptBytes(scripts, { playerChunkPattern: "player", allowsPlayer: false })).toEqual({
      countedBytes: kb(50),
      playerUrls: ["http://x/player-abc.js"],
    });
  });

  test("leaves the player chunk out when the page may carry it", () => {
    expect(scriptBytes(scripts, { playerChunkPattern: "player", allowsPlayer: true })).toEqual({
      countedBytes: kb(10),
      playerUrls: ["http://x/player-abc.js"],
    });
  });

  test("ignores scripts without a size", () => {
    const missing = [{ url: "http://x/b.js" }, script("http://x/a.js", 1)];
    expect(
      scriptBytes(missing, { playerChunkPattern: "player", allowsPlayer: false }).countedBytes,
    ).toBe(kb(1));
  });
});

describe("evaluatePage", () => {
  test("has no findings inside the budgets", () => {
    const result = evaluatePage(page(), config);
    expect(result.findings).toEqual([]);
    expect(result.firstLoadKb).toBe(100);
    expect(result.lcpMs).toBe(1800);
  });

  test("flags first-load JavaScript over the public budget", () => {
    const result = evaluatePage(
      page({ runs: [run(1000, script("http://x/a.js", 160.25))] }),
      config,
    );
    expect(result.findings).toEqual(["/ first-load JS is 160.3 KB gzipped, budget 150 KB"]);
  });

  test("allows 150 KB exactly", () => {
    expect(
      evaluatePage(page({ runs: [run(1000, script("http://x/a.js", 150))] }), config).findings,
    ).toEqual([]);
  });

  test("uses the learner budget for learner pages and excludes the player", () => {
    const learner = page({
      path: "/learn/a",
      kind: "learner",
      allowsPlayer: true,
      runs: [run(1000, script("http://x/a.js", 190), script("http://x/player.js", 300))],
    });
    expect(evaluatePage(learner, config).findings).toEqual([]);
    const over = page({
      path: "/dashboard",
      kind: "learner",
      runs: [run(1000, script("http://x/a.js", 210))],
    });
    expect(evaluatePage(over, config).findings).toEqual([
      "/dashboard first-load JS is 210.0 KB gzipped, budget 200 KB",
    ]);
  });

  test("flags a player chunk on a page that is not a lesson", () => {
    const result = evaluatePage(
      page({ runs: [run(1000, script("http://x/player-1.js", 5))] }),
      config,
    );
    expect(result.findings).toEqual([
      "/ requested the player chunk http://x/player-1.js, which only lesson pages may load",
    ]);
  });

  test("judges the median of the runs, not the worst one", () => {
    const runs = [
      run(4000, script("http://x/a.js", 100)),
      run(2000, script("http://x/a.js", 100)),
      run(2200, script("http://x/a.js", 100)),
    ];
    const result = evaluatePage(page({ runs }), config);
    expect(result.lcpMs).toBe(2200);
    expect(result.findings).toEqual([]);
  });

  test("flags a median LCP above 2.5 s in seconds", () => {
    const runs = [run(3100, script("http://x/a.js", 1)), run(2900, script("http://x/a.js", 1))];
    expect(evaluatePage(page({ runs }), config).findings).toEqual([
      "/ LCP is 3.0 s on Slow 4G mobile, budget 2.5 s",
    ]);
  });

  test("flags a page whose LCP was never measured", () => {
    const result = evaluatePage(page({ runs: [run(null, script("http://x/a.js", 1))] }), config);
    expect(result.findings).toEqual(["/ LCP could not be measured"]);
  });

  test("flags a page with no completed run", () => {
    expect(evaluatePage(page({ runs: [] }), config).findings).toEqual([
      "/ has no completed Lighthouse run",
    ]);
  });
});

describe("report", () => {
  const ok = { pages: [page()] };
  const over = { pages: [page({ runs: [run(1000, script("http://x/a.js", 160))] })] };

  test("is quiet and says so when everything is inside the budgets", () => {
    const { annotations, summary } = report(ok, { outcome: "success", artifactUrl: "https://a/1" });
    expect(annotations).toEqual([]);
    expect(summary).toContain("Lighthouse budgets");
    expect(summary).toContain("| / | public | 100.0 KB | 1.8 s |");
    expect(summary).toContain("https://a/1");
    expect(summary).toContain("never blocks a merge");
  });

  test("turns each finding into a warning annotation naming page, budget and value", () => {
    const { annotations, summary } = report(over, { outcome: "success" });
    expect(annotations).toEqual([
      "::warning title=Lighthouse budget::/ first-load JS is 160.0 KB gzipped, budget 150 KB",
    ]);
    expect(summary).toContain("/ first-load JS is 160.0 KB gzipped, budget 150 KB");
  });

  test("warns when the run produced no results", () => {
    const { annotations, summary } = report(null, { outcome: "failure" });
    expect(annotations).toHaveLength(1);
    expect(annotations[0]).toMatch(/^::warning title=Lighthouse run did not finish::/);
    expect(summary).toContain("did not finish");
  });

  test("warns when the step failed even though partial results exist", () => {
    const { annotations } = report(ok, { outcome: "failure" });
    expect(annotations[0]).toMatch(/^::warning title=Lighthouse run did not finish::/);
  });

  test("never emits an error annotation", () => {
    for (const results of [ok, over, null]) {
      const { annotations } = report(results, { outcome: "failure" });
      expect(annotations.every((line) => line.startsWith("::warning "))).toBe(true);
    }
  });
});
