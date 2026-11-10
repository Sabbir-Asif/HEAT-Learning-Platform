import { adminCsrf, csrfHeaderName, studentCsrf } from "@heat/contracts";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createCsrfInterceptor, installCsrf, readDocumentCookie } from "../../src/mutator/csrf";
import { customFetch } from "../../src/mutator/custom-fetch";

const fetchMock = vi.fn<typeof fetch>();
let uninstall: (() => void) | undefined;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  uninstall?.();
  uninstall = undefined;
  vi.unstubAllGlobals();
});

const headerOf = (call: number): string | null =>
  new Headers(fetchMock.mock.calls[call]?.[1]?.headers).get(csrfHeaderName);

const cookies =
  (values: Record<string, string>) =>
  (name: string): string | undefined =>
    values[name];

describe("CSRF interceptor", () => {
  test.each(["POST", "PUT", "PATCH", "DELETE"])(
    "attaches the cookie token to a %s request",
    async (method) => {
      uninstall = installCsrf({ readCookie: cookies({ [studentCsrf.cookie]: "token-1" }) });

      await customFetch("/api/auth/sign-out", { method });

      expect(headerOf(0)).toBe("token-1");
    },
  );

  test("leaves safe methods alone", async () => {
    uninstall = installCsrf({ readCookie: cookies({ [studentCsrf.cookie]: "token-1" }) });

    await customFetch("/api/me");
    await customFetch("/api/me", { method: "HEAD" });

    expect(headerOf(0)).toBeNull();
    expect(headerOf(1)).toBeNull();
  });

  test("reads the cookie on every request, so a token rotated by sign-in or refresh is used", async () => {
    const jar: Record<string, string> = { [studentCsrf.cookie]: "old" };
    uninstall = installCsrf({ readCookie: cookies(jar) });

    await customFetch("/api/x", { method: "POST" });
    jar[studentCsrf.cookie] = "new";
    await customFetch("/api/x", { method: "POST" });

    expect([headerOf(0), headerOf(1)]).toEqual(["old", "new"]);
  });

  test("does not send the header on the pre-session paths and never fetches a token for them", async () => {
    uninstall = installCsrf({ readCookie: cookies({}) });

    await customFetch("/api/auth/sign-in", { method: "POST" });
    await customFetch("/api/auth/refresh", { method: "POST" });
    await customFetch("/api/captcha", { method: "POST" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "/api/auth/sign-in",
      "/api/auth/refresh",
      "/api/captcha",
    ]);
    expect([headerOf(0), headerOf(1), headerOf(2)]).toEqual([null, null, null]);
  });

  test("fetches the token once from the token endpoint when the cookie is missing", async () => {
    fetchMock.mockImplementation(async (input) =>
      String(input) === studentCsrf.tokenPath
        ? new Response(JSON.stringify({ token: "fetched" }), { status: 200 })
        : new Response(null, { status: 204 }),
    );
    uninstall = installCsrf({ readCookie: cookies({}) });

    await Promise.all([
      customFetch("/api/a", { method: "POST" }),
      customFetch("/api/b", { method: "POST" }),
    ]);

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.filter((url) => url === studentCsrf.tokenPath)).toHaveLength(1);
    const tokenCall = fetchMock.mock.calls.find(([url]) => String(url) === studentCsrf.tokenPath);
    expect(tokenCall?.[1]?.credentials).toBe("include");
    const sent = fetchMock.mock.calls
      .filter(([url]) => String(url).startsWith("/api/") && String(url) !== studentCsrf.tokenPath)
      .map(([, init]) => new Headers(init?.headers).get(csrfHeaderName));
    expect(sent).toEqual(["fetched", "fetched"]);
  });

  test("sends the request without a header when no token can be obtained", async () => {
    fetchMock.mockImplementation(async (input) =>
      String(input) === studentCsrf.tokenPath
        ? new Response(
            JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "x", requestId: "r" } }),
            { status: 401 },
          )
        : new Response(null, { status: 204 }),
    );
    uninstall = installCsrf({ readCookie: cookies({}) });

    await customFetch("/api/a", { method: "POST" });

    expect(headerOf(1)).toBeNull();
  });

  test("does not retry the token fetch for a few seconds after it failed", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(async (input) =>
        String(input) === studentCsrf.tokenPath
          ? new Response(null, { status: 401 })
          : new Response(null, { status: 204 }),
      );
      uninstall = installCsrf({ readCookie: cookies({}) });

      await customFetch("/api/a", { method: "POST" });
      await customFetch("/api/b", { method: "POST" });
      const tokenFetches = () =>
        fetchMock.mock.calls.filter(([url]) => String(url) === studentCsrf.tokenPath).length;
      expect(tokenFetches()).toBe(1);

      await vi.advanceTimersByTimeAsync(10_000);
      await customFetch("/api/c", { method: "POST" });
      expect(tokenFetches()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test("uses the admin cookie and token path when configured", async () => {
    uninstall = installCsrf({
      cookieName: adminCsrf.cookie,
      tokenPath: adminCsrf.tokenPath,
      skipPaths: ["/api/admin/auth/sign-in", "/api/admin/auth/refresh"],
      readCookie: cookies({ [adminCsrf.cookie]: "admin-token", [studentCsrf.cookie]: "student" }),
    });

    await customFetch("/api/admin/auth/sign-out", { method: "POST" });

    expect(headerOf(0)).toBe("admin-token");
  });

  test("keeps the other headers of the request", async () => {
    const interceptor = createCsrfInterceptor({
      readCookie: cookies({ [studentCsrf.cookie]: "t" }),
    });

    const result = await interceptor({
      url: "/api/x",
      init: { method: "post", headers: { "x-other": "1" } },
    });

    const headers = new Headers(result.init.headers);
    expect(headers.get("x-other")).toBe("1");
    expect(headers.get(csrfHeaderName)).toBe("t");
  });

  test("installing again replaces the previous interceptor instead of stacking", async () => {
    installCsrf({ readCookie: cookies({ [studentCsrf.cookie]: "first" }) });
    uninstall = installCsrf({ readCookie: cookies({ [studentCsrf.cookie]: "second" }) });

    await customFetch("/api/x", { method: "POST" });

    expect(headerOf(0)).toBe("second");
  });

  test("the uninstall function removes the interceptor", async () => {
    const remove = installCsrf({ readCookie: cookies({ [studentCsrf.cookie]: "t" }) });
    remove();

    await customFetch("/api/x", { method: "POST" });

    expect(headerOf(0)).toBeNull();
  });
});

describe("readDocumentCookie", () => {
  afterEach(() => {
    document.cookie = "csrf-probe=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  test("reads a cookie by name from document.cookie", () => {
    document.cookie = "csrf-probe=abc%2D123; path=/";

    expect(readDocumentCookie("csrf-probe")).toBe("abc-123");
    expect(readDocumentCookie("missing")).toBeUndefined();
  });
});
