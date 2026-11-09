import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { config } from "./budget.mjs";
import { resultsDir } from "./paths.mjs";

const root = resolve(import.meta.dirname, "../../..");
const runTimeoutMs = 120_000;
const serverTimeoutMs = 60_000;

const settings = {
  formFactor: "mobile",
  throttlingMethod: "simulate",
  throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
  onlyCategories: ["performance"],
};

const slug = (path) => (path === "/" ? "home" : path.replace(/^\/|\/$/g, "").replaceAll("/", "-"));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function startServer(app) {
  const child = spawn(
    "pnpm",
    ["--filter", app, "exec", "next", "start", "--port", String(config.port)],
    {
      cwd: root,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    },
  );
  return () => {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  };
}

async function waitForServer(url) {
  const deadline = Date.now() + serverTimeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`Server at ${url} did not start within ${serverTimeoutMs / 1000} s`);
}

async function withTimeout(work, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${runTimeoutMs / 1000} s`)),
      runTimeoutMs,
    );
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function auditOnce(url, name, index) {
  const chrome = await launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const { lhr, report } = await withTimeout(
      lighthouse(
        url,
        { port: chrome.port, output: ["json", "html"], logLevel: "error" },
        { extends: "lighthouse:default", settings },
      ),
      `Lighthouse run ${index + 1} of ${name}`,
    );
    writeFileSync(join(resultsDir, `${name}-${index + 1}.json`), report[0]);
    writeFileSync(join(resultsDir, `${name}-${index + 1}.html`), report[1]);
    const requests = lhr.audits["network-requests"].details?.items ?? [];
    return {
      lcpMs: lhr.audits["largest-contentful-paint"].numericValue ?? null,
      scripts: requests
        .filter((request) => request.resourceType === "Script")
        .map(({ url: scriptUrl, transferSize }) => ({ url: scriptUrl, transferSize })),
    };
  } finally {
    await chrome.kill();
  }
}

async function main() {
  rmSync(resultsDir, { recursive: true, force: true });
  mkdirSync(resultsDir, { recursive: true });
  const pages = [];
  let failed = false;
  const apps = [...new Set(config.pages.map(({ app }) => app))];
  for (const app of apps) {
    const stop = startServer(app);
    try {
      await waitForServer(`http://localhost:${config.port}/`);
      for (const entry of config.pages.filter((candidate) => candidate.app === app)) {
        const result = {
          path: entry.path,
          kind: entry.kind,
          allowsPlayer: entry.allowsPlayer ?? false,
          runs: [],
        };
        pages.push(result);
        if (entry.auth) {
          failed = true;
          console.error(
            `${entry.path} needs sign-in, which the Lighthouse runner does not support yet`,
          );
          continue;
        }
        for (let index = 0; index < config.runs; index += 1) {
          try {
            result.runs.push(
              await auditOnce(
                `http://localhost:${config.port}${entry.path}`,
                slug(entry.path),
                index,
              ),
            );
          } catch (error) {
            failed = true;
            console.error(error);
          }
        }
      }
    } catch (error) {
      failed = true;
      console.error(error);
    } finally {
      stop();
    }
  }
  writeFileSync(join(resultsDir, "results.json"), JSON.stringify({ pages }, null, 2));
  process.exitCode = failed ? 1 : 0;
}

await main();
