import { spawnStandalone } from "../bin/standalone.mjs";

export const serverTimeoutMs = 60_000;

const defaultSleep = (ms) => new Promise((done) => setTimeout(done, ms));

export function startServer(app, port) {
  const child = spawnStandalone(app, port, { detached: true, stdio: "ignore" });
  return () => {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  };
}

export async function waitForServer(
  url,
  { timeoutMs = serverTimeoutMs, intervalMs = 500, fetchFn = fetch, sleep = defaultSleep } = {},
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await fetchFn(url).then(
      (response) => response.ok,
      () => false,
    );
    if (ready) return;
    await sleep(intervalMs);
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs / 1000} s`);
}
