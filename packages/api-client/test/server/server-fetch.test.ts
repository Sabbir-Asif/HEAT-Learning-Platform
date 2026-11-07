import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ApiError } from "../../src/errors";

vi.mock("server-only", () => ({}));
const incoming = vi.fn<() => Headers>();
vi.mock("next/headers", () => ({ headers: async () => incoming() }));

const { ApiClientConfigError, serverFetch } = await import("../../src/server/server-fetch");

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init);
const sent = () => {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url: String(url), init: (init ?? {}) as RequestInit & { next?: unknown } };
};

beforeEach(() => {
  fetchMock.mockReset();
  incoming.mockReset();
  incoming.mockReturnValue(new Headers({ cookie: "sid=abc; theme=dark" }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_INTERNAL_URL", "http://api:4000");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("address", () => {
  test("calls the internal API address from API_INTERNAL_URL", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: "ok" }));
    await expect(serverFetch("/api/health")).resolves.toEqual({ status: "ok" });
    expect(sent().url).toBe("http://api:4000/api/health");
  });

  test("a path without /api gets it once, and a trailing slash in the variable is fine", async () => {
    vi.stubEnv("API_INTERNAL_URL", "http://api:4000/");
    fetchMock.mockImplementation(async () => json({}));
    await serverFetch("/health");
    await serverFetch("/api/health?x=1");
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "http://api:4000/api/health",
      "http://api:4000/api/health?x=1",
    ]);
  });

  test.each([undefined, "", "   "])(
    "a missing variable (%j) is a clear error, with no localhost fallback",
    async (value) => {
      if (value === undefined) vi.stubEnv("API_INTERNAL_URL", undefined as unknown as string);
      else vi.stubEnv("API_INTERNAL_URL", value);
      const error = await serverFetch("/api/health").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiClientConfigError);
      expect((error as Error).message).toContain("API_INTERNAL_URL");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  test.each(["api:4000", "ftp://api:4000", "http://api:4000/internal", "not a url"])(
    "the value %j is refused",
    async (value) => {
      vi.stubEnv("API_INTERNAL_URL", value);
      await expect(serverFetch("/api/health")).rejects.toBeInstanceOf(ApiClientConfigError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  test("the configuration is read when the fetcher is used, not when it is imported", async () => {
    vi.stubEnv("API_INTERNAL_URL", "http://other:4000");
    fetchMock.mockResolvedValueOnce(json({}));
    await serverFetch("/api/health");
    expect(sent().url).toBe("http://other:4000/api/health");
  });

  test.each([
    "https://evil.example/api/health",
    "//evil.example/api/health",
    "/\\evil.example",
    "api/health",
  ])("refuses %j, so the fetcher cannot be pointed at another host", async (path) => {
    await expect(serverFetch(path)).rejects.toThrow(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("cookies", () => {
  test("forwards the incoming Cookie header and nothing else from the incoming request", async () => {
    incoming.mockReturnValue(
      new Headers({
        cookie: "sid=abc; theme=dark",
        authorization: "Bearer secret",
        "x-forwarded-for": "10.0.0.1",
        host: "learn.example",
        "x-csrf-token": "t",
      }),
    );
    fetchMock.mockResolvedValueOnce(json({}));
    await serverFetch("/api/me", { headers: { accept: "application/json" } });
    const outgoing = new Headers(sent().init.headers);
    expect([...outgoing.keys()].sort()).toEqual(["accept", "cookie"]);
    expect(outgoing.get("cookie")).toBe("sid=abc; theme=dark");
  });

  test("a Cookie header supplied by the caller is replaced by the incoming one", async () => {
    fetchMock.mockResolvedValueOnce(json({}));
    await serverFetch("/api/me", { headers: { cookie: "sid=attacker" } });
    expect(new Headers(sent().init.headers).get("cookie")).toBe("sid=abc; theme=dark");
  });

  test("sends no Cookie header when the request had none", async () => {
    incoming.mockReturnValue(new Headers());
    fetchMock.mockResolvedValueOnce(json({}));
    await serverFetch("/api/news");
    expect(new Headers(sent().init.headers).has("cookie")).toBe(false);
  });

  test("forwardCookies: false skips the request headers, as a 'use cache' function must", async () => {
    fetchMock.mockResolvedValueOnce(json({}));
    await serverFetch("/api/news", { forwardCookies: false, headers: { cookie: "sid=attacker" } });
    expect(incoming).not.toHaveBeenCalled();
    expect(new Headers(sent().init.headers).has("cookie")).toBe(false);
    expect(sent().init).not.toHaveProperty("forwardCookies");
  });

  test("Set-Cookie from the API is not handed back, on success or on error", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ ok: true }, { headers: { "set-cookie": "sid=new; HttpOnly" } }),
    );
    const body = await serverFetch<Record<string, unknown>>("/api/me");
    expect(body).toEqual({ ok: true });

    fetchMock.mockResolvedValueOnce(
      json(
        { error: { code: "FORBIDDEN", message: "x", requestId: "r" } },
        { status: 403, headers: { "set-cookie": "sid=new" } },
      ),
    );
    const error = await serverFetch("/api/me").catch((e: unknown) => e);
    expect(JSON.stringify(Object.entries(error as object))).not.toContain("sid=new");
  });
});

describe("request", () => {
  test("does not follow redirects, so cookies never travel to a Location", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "https://evil.example/" } }),
    );
    const error = await serverFetch("/api/me").catch((e: unknown) => e);
    expect(sent().init.redirect).toBe("manual");
    expect(error).toMatchObject({ status: 302, code: "UNEXPECTED_RESPONSE" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("is uncached by default, so a per-user response is never cached by accident", async () => {
    fetchMock.mockResolvedValueOnce(json({}));
    await serverFetch("/api/me");
    expect(sent().init.cache).toBe("no-store");
  });

  test("keeps a cache choice the caller made", async () => {
    fetchMock.mockImplementation(async () => json({}));
    await serverFetch("/api/news", { forwardCookies: false, cache: "force-cache" });
    await serverFetch("/api/news", {
      forwardCookies: false,
      next: { revalidate: 60, tags: ["news"] },
    } as RequestInit);
    expect(fetchMock.mock.calls[0]?.[1]?.cache).toBe("force-cache");
    const second = fetchMock.mock.calls[1]?.[1] as RequestInit & { next?: unknown };
    expect(second.cache).toBeUndefined();
    expect(second.next).toEqual({ revalidate: 60, tags: ["news"] });
  });

  test("passes the caller's signal and method", async () => {
    fetchMock.mockResolvedValueOnce(json({}));
    const controller = new AbortController();
    await serverFetch("/api/items", { method: "POST", signal: controller.signal, body: "{}" });
    expect(sent().init.signal).toBe(controller.signal);
    expect(sent().init.method).toBe("POST");
  });
});

describe("errors", () => {
  test("an API envelope becomes the same ApiError the browser mutator throws", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        {
          error: {
            code: "NOT_FOUND",
            message: "x",
            requestId: "req-3",
            fields: [{ path: "id", code: "invalid" }],
          },
        },
        { status: 404 },
      ),
    );
    const error = await serverFetch("/api/me").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      requestId: "req-3",
      fields: [{ path: "id", code: "invalid" }],
    });
  });

  test("a network failure is NETWORK_ERROR", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("getaddrinfo ENOTFOUND api"));
    await expect(serverFetch("/api/me")).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
    });
  });
});
