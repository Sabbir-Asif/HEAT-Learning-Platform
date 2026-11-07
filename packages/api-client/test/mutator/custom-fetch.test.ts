import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ApiError } from "../../src/errors";
import { customFetch } from "../../src/mutator/custom-fetch";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const lastCall = () => {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url, init: init as RequestInit };
};

describe("request", () => {
  test("sends a same-origin relative URL and includes credentials", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: "ok" }));
    await customFetch("/api/health", { method: "GET" });
    expect(lastCall().url).toBe("/api/health");
    expect(lastCall().init.credentials).toBe("include");
    expect(lastCall().init.method).toBe("GET");
  });

  test("adds the /api prefix once: a path without it gets it, a path with it keeps it", async () => {
    fetchMock.mockImplementation(async () => json({}));
    await customFetch("/health");
    await customFetch("/api/health?x=1");
    await customFetch("/api");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/health",
      "/api/health?x=1",
      "/api",
    ]);
  });

  test("refuses an absolute URL, so the API client cannot be pointed at another origin", async () => {
    await expect(customFetch("https://evil.example/api/health")).rejects.toThrow(TypeError);
    await expect(customFetch("//evil.example/api/health")).rejects.toThrow(TypeError);
    await expect(customFetch("/\\evil.example/api/health")).rejects.toThrow(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a caller cannot turn credentials off", async () => {
    fetchMock.mockResolvedValueOnce(json({}));
    await customFetch("/api/health", { credentials: "omit" });
    expect(lastCall().init.credentials).toBe("include");
  });

  test("passes the caller's AbortSignal through", async () => {
    fetchMock.mockResolvedValueOnce(json({}));
    const controller = new AbortController();
    await customFetch("/api/health", { signal: controller.signal });
    expect(lastCall().init.signal).toBe(controller.signal);
  });

  test("keeps Content-Type for a JSON body", async () => {
    fetchMock.mockResolvedValueOnce(json({}));
    await customFetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
    expect(new Headers(lastCall().init.headers).get("content-type")).toBe("application/json");
  });

  test("sends no Content-Type without a body", async () => {
    fetchMock.mockResolvedValueOnce(json({}));
    await customFetch("/api/items/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    expect(new Headers(lastCall().init.headers).has("content-type")).toBe(false);
  });

  test("sends no Content-Type for FormData, so the browser sets the multipart boundary", async () => {
    fetchMock.mockResolvedValueOnce(json({}));
    await customFetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: new FormData(),
    });
    expect(new Headers(lastCall().init.headers).has("content-type")).toBe(false);
  });
});

describe("success", () => {
  test("returns the parsed JSON body", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: "ok" }));
    await expect(customFetch("/api/health")).resolves.toEqual({ status: "ok" });
  });

  test("a 204 does not throw and gives undefined", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(customFetch("/api/items/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  test("an empty 200 body does not throw", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
    await expect(customFetch("/api/items/1")).resolves.toBeUndefined();
  });

  test("a success body that is not JSON gives UNEXPECTED_RESPONSE and does not leak the body", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>secret-detail</html>", { status: 200 }));
    const error = await customFetch("/api/health").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 200, code: "UNEXPECTED_RESPONSE" });
    expect(JSON.stringify(error)).not.toContain("secret-detail");
  });
});

describe("errors", () => {
  test.each([
    [400, "VALIDATION_FAILED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [429, "RATE_LIMITED"],
    [500, "INTERNAL"],
  ])("a %i envelope surfaces code %s with the field paths", async (status, code) => {
    fetchMock.mockResolvedValueOnce(
      json(
        {
          error: {
            code,
            message: "text",
            requestId: "req-9",
            fields: [{ path: "email", code: "invalid" }],
          },
        },
        status,
      ),
    );
    const error = await customFetch("/api/health").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status,
      code,
      requestId: "req-9",
      fields: [{ path: "email", code: "invalid" }],
    });
  });

  test("an Nginx 502 HTML page gives UNEXPECTED_RESPONSE without the page", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    const error = await customFetch("/api/health").catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: "UNEXPECTED_RESPONSE" });
    expect((error as ApiError).message).not.toContain("Bad Gateway");
  });

  test("a network failure gives NETWORK_ERROR with no raw error attached", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch https://internal.host/secret"));
    const error = await customFetch("/api/health").catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
    expect((error as ApiError).message).not.toContain("internal.host");
    expect((error as ApiError).cause).toBeUndefined();
  });

  test("an abort gives REQUEST_ABORTED", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValueOnce(new DOMException("The operation was aborted.", "AbortError"));
    const error = await customFetch("/api/health", { signal: controller.signal }).catch(
      (e: unknown) => e,
    );
    expect(error).toMatchObject({ status: 0, code: "REQUEST_ABORTED" });
  });

  test("an abort while the body is being read gives REQUEST_ABORTED", async () => {
    const response = new Response("{}", { status: 200 });
    Object.defineProperty(response, "text", {
      value: () => Promise.reject(new DOMException("aborted", "AbortError")),
    });
    fetchMock.mockResolvedValueOnce(response);
    const error = await customFetch("/api/health").catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "REQUEST_ABORTED" });
  });

  test("keeps Retry-After on a 429", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: "RATE_LIMITED", message: "x", requestId: "r" } }),
        {
          status: 429,
          headers: { "Retry-After": "12" },
        },
      ),
    );
    const error = await customFetch("/api/health").catch((e: unknown) => e);
    expect((error as ApiError).retryAfterSeconds).toBe(12);
  });
});
