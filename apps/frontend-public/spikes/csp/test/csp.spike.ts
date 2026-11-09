import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  build,
  hashOf,
  inlineScripts,
  nonceOf,
  scriptSrc,
  scriptsWithoutNonce,
  start,
  type RunningServer,
} from "./harness";
import { THEME_SCRIPT_HASH, buildPolicy } from "../src/policy";

const header = "content-security-policy-report-only";

async function get(server: RunningServer, path: string) {
  const response = await fetch(`${server.origin}${path}`);
  return { response, html: await response.text() };
}

describe("policy builder", () => {
  test("has no unsafe-inline and no unsafe-eval in script-src in production", () => {
    const policy = buildPolicy({ nonce: "abc", development: false });
    expect(scriptSrc(policy)).not.toContain("unsafe-inline");
    expect(scriptSrc(policy)).not.toContain("unsafe-eval");
  });

  test("allows unsafe-eval only in development", () => {
    expect(scriptSrc(buildPolicy({ nonce: "abc", development: true }))).toContain("'unsafe-eval'");
  });
});

describe("partial prerender build (cacheComponents)", () => {
  let buildOutput = "";
  let server: RunningServer;

  beforeAll(async () => {
    buildOutput = build("partial");
    server = await start("partial", 3931, false);
  });
  afterAll(() => server.stop());

  test("the cached page is listed as static and the dynamic page as partial prerender", () => {
    expect(buildOutput).toMatch(/○ \/cached\s/);
    expect(buildOutput).toMatch(/◐ \/dynamic/);
  });

  test("the cached page stays static even though the proxy runs on it", async () => {
    const { response } = await get(server, "/cached");
    expect(response.headers.get("x-nextjs-cache")).toBe("HIT");
    expect(response.headers.get("cache-control")).toContain("s-maxage");
  });

  test("the proxy header on the cached page carries a fresh nonce that no script uses", async () => {
    const first = await get(server, "/cached");
    const second = await get(server, "/cached");
    expect(nonceOf(first.response.headers.get(header) ?? "")).not.toBe("");
    expect(first.html).not.toContain(nonceOf(first.response.headers.get(header) ?? ""));
    expect(second.html).toBe(first.html);
  });

  test("the static shell scripts carry no nonce, so a nonce policy cannot cover them", async () => {
    const { html } = await get(server, "/dynamic");
    expect(scriptsWithoutNonce(html).length).toBeGreaterThan(5);
  });

  test("two cached pages have different inline script hashes, so hashes are per page and per revalidation", async () => {
    const a = new Set(inlineScripts((await get(server, "/cached")).html).map(hashOf));
    const b = new Set(inlineScripts((await get(server, "/cached-b")).html).map(hashOf));
    const shared = [...a].filter((hash) => b.has(hash));
    const own = [...a].filter((hash) => !b.has(hash));
    expect(shared).toContain(THEME_SCRIPT_HASH);
    expect(own.length).toBeGreaterThan(0);
  });
});

describe("fully dynamic build", () => {
  let buildOutput = "";
  let server: RunningServer;

  beforeAll(async () => {
    buildOutput = build("dynamic");
    server = await start("dynamic", 3932, false);
  });
  afterAll(() => server.stop());

  test("the dynamic page renders on demand and the cached page stays static", () => {
    expect(buildOutput).toMatch(/ƒ \/dynamic/);
    expect(buildOutput).toMatch(/○ \/cached\s/);
  });

  test("the nonce differs between two requests and matches the scripts", async () => {
    const first = await get(server, "/dynamic");
    const second = await get(server, "/dynamic");
    const nonceOne = nonceOf(first.response.headers.get(header) ?? "");
    const nonceTwo = nonceOf(second.response.headers.get(header) ?? "");
    expect(nonceOne).not.toBe(nonceTwo);
    expect(first.html).toContain(`nonce="${nonceOne}"`);
    expect(first.html).not.toContain(nonceTwo);
  });

  test("the dynamic page is not cacheable", async () => {
    const { response } = await get(server, "/dynamic");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  test("the only script without a nonce is the theme script, covered by one stable hash", async () => {
    const { response, html } = await get(server, "/dynamic");
    const bare = scriptsWithoutNonce(html).filter((tag) => !tag.includes(" src="));
    expect(bare).toHaveLength(1);
    expect(hashOf(inlineScripts(bare[0] ?? "")[0] ?? "")).toBe(THEME_SCRIPT_HASH);
    expect(scriptSrc(response.headers.get(header) ?? "")).toContain(THEME_SCRIPT_HASH);
  });

  test("every served policy has no unsafe-inline or unsafe-eval in script-src", async () => {
    for (const path of ["/dynamic", "/cached", "/missing"]) {
      const { response } = await get(server, path);
      const source = scriptSrc(response.headers.get(header) ?? "");
      expect(source).not.toBe("");
      expect(source).not.toContain("unsafe-inline");
      expect(source).not.toContain("unsafe-eval");
    }
  });

  test("the not-found page carries the same policy", async () => {
    const { response } = await get(server, "/missing");
    expect(response.status).toBe(404);
    expect(response.headers.get(header)).toContain("script-src");
  });

  test("the report endpoint accepts a small report and rejects an oversized one", async () => {
    const small = await fetch(`${server.origin}/csp-report`, { method: "POST", body: "{}" });
    const large = await fetch(`${server.origin}/csp-report`, {
      method: "POST",
      body: "x".repeat(9000),
    });
    expect(small.status).toBe(204);
    expect(large.status).toBe(413);
  });
});
