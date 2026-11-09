import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { customFetch } from "../../src/mutator/custom-fetch";
import { createSessionRefresh, installSessionRefresh } from "../../src/mutator/session-refresh";
import { ApiError } from "../../src/errors";

const fetchMock = vi.fn<typeof fetch>();
let uninstall: (() => void) | undefined;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  uninstall?.();
  uninstall = undefined;
  vi.unstubAllGlobals();
});

const envelope = (code: string, status: number) =>
  new Response(JSON.stringify({ error: { code, message: code, requestId: "r" } }), { status });

const paths = () => fetchMock.mock.calls.map(([url]) => String(url));

describe("session refresh on 401", () => {
  test("three parallel calls that each get 401 send one refresh and all succeed on retry", async () => {
    let refreshed = false;
    let refreshCalls = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/auth/refresh") {
        refreshCalls += 1;
        await gate;
        refreshed = true;
        return new Response(null, { status: 204 });
      }
      return refreshed
        ? new Response(JSON.stringify({ url }), { status: 200 })
        : envelope("UNAUTHENTICATED", 401);
    });
    uninstall = installSessionRefresh();

    const results = Promise.all([
      customFetch<{ url: string }>("/api/me"),
      customFetch<{ url: string }>("/api/me?a=1"),
      customFetch<{ url: string }>("/api/other"),
    ]);
    await vi.waitFor(() => expect(refreshCalls).toBe(1));
    release();

    await expect(results).resolves.toEqual([
      { url: "/api/me" },
      { url: "/api/me?a=1" },
      { url: "/api/other" },
    ]);
    expect(refreshCalls).toBe(1);
    expect(paths().filter((path) => path !== "/api/auth/refresh")).toHaveLength(6);
  });

  test("a later 401 starts a new refresh once the first has finished", async () => {
    let refreshCalls = 0;
    let authorised = false;
    fetchMock.mockImplementation(async (input) => {
      if (String(input) === "/api/auth/refresh") {
        refreshCalls += 1;
        authorised = true;
        return new Response(null, { status: 204 });
      }
      const ok = authorised;
      authorised = false;
      return ok ? new Response("{}", { status: 200 }) : envelope("UNAUTHENTICATED", 401);
    });
    uninstall = installSessionRefresh();

    await customFetch("/api/me");
    await customFetch("/api/me");

    expect(refreshCalls).toBe(2);
  });

  test("a failed refresh surfaces the original 401 once, calls onExpired and does not retry", async () => {
    const onExpired = vi.fn();
    fetchMock.mockImplementation(async () => envelope("UNAUTHENTICATED", 401));
    uninstall = installSessionRefresh({ onExpired });

    await expect(customFetch("/api/me")).rejects.toMatchObject({ status: 401 });

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(paths()).toEqual(["/api/me", "/api/auth/refresh"]);
  });

  test("a network failure during refresh does not count as an expired session", async () => {
    const onExpired = vi.fn();
    fetchMock.mockImplementation(async (input) => {
      if (String(input) === "/api/auth/refresh") throw new TypeError("offline");
      return envelope("UNAUTHENTICATED", 401);
    });
    uninstall = installSessionRefresh({ onExpired });

    await expect(customFetch("/api/me")).rejects.toBeInstanceOf(ApiError);

    expect(onExpired).not.toHaveBeenCalled();
  });

  test("a wrong-password 401 on sign-in and a 401 from refresh itself never trigger a refresh", async () => {
    fetchMock.mockImplementation(async () => envelope("INVALID_CREDENTIALS", 401));
    uninstall = installSessionRefresh();

    await expect(customFetch("/api/auth/sign-in", { method: "POST" })).rejects.toMatchObject({
      status: 401,
    });
    await expect(customFetch("/api/auth/refresh", { method: "POST" })).rejects.toMatchObject({
      status: 401,
    });

    expect(paths()).toEqual(["/api/auth/sign-in", "/api/auth/refresh"]);
  });

  test("createSessionRefresh honours a custom refresh path and skip list", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
    const handler = createSessionRefresh({
      refreshPath: "/api/x/refresh",
      skipPaths: ["/api/skip"],
    });
    const error = new ApiError({ status: 401, code: "UNAUTHENTICATED" });

    expect(await handler(error, { url: "/api/skip?q=1" })).toBe(false);
    expect(await handler(error, { url: "/api/me" })).toBe(true);
    expect(paths()).toEqual(["/api/x/refresh"]);
  });
});
