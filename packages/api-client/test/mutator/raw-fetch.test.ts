import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { registerRequestInterceptor, setUnauthorizedHandler } from "../../src/mutator/extensions";
import { fetchResponse } from "../../src/mutator/raw-fetch";

const fetchMock = vi.fn<typeof fetch>();

const unauthenticated = () =>
  new Response(
    JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "x", requestId: "r" } }),
    { status: 401 },
  );

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  setUnauthorizedHandler(undefined);
  vi.unstubAllGlobals();
});

test("returns the response with its headers and does not throw on an error status", async () => {
  fetchMock.mockResolvedValueOnce(
    new Response(null, { status: 409, headers: { "Upload-Offset": "10" } }),
  );
  const response = await fetchResponse("/admin/x", { method: "PATCH" });
  expect(response.status).toBe(409);
  expect(response.headers.get("Upload-Offset")).toBe("10");
});

test("prefixes the path, sends credentials and applies the interceptors", async () => {
  const remove = registerRequestInterceptor((request) => {
    const headers = new Headers(request.init.headers);
    headers.set("x-csrf-token", "t");
    return { ...request, init: { ...request.init, headers } };
  });
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await fetchResponse("/admin/x", { method: "POST", headers: { "Tus-Resumable": "1.0.0" } });
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  expect(url).toBe("/api/admin/x");
  expect(init?.credentials).toBe("include");
  const headers = new Headers(init?.headers);
  expect(headers.get("x-csrf-token")).toBe("t");
  expect(headers.get("Tus-Resumable")).toBe("1.0.0");
  remove();
});

test("refreshes the session once on a 401 and retries", async () => {
  const handler = vi.fn().mockResolvedValue(true);
  setUnauthorizedHandler(handler);
  fetchMock.mockResolvedValueOnce(unauthenticated());
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  const response = await fetchResponse("/admin/x", { method: "PATCH" });
  expect(response.status).toBe(204);
  expect(handler).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("returns the 401 when the refresh fails or nothing is registered", async () => {
  fetchMock.mockResolvedValueOnce(unauthenticated());
  expect((await fetchResponse("/admin/x")).status).toBe(401);
  setUnauthorizedHandler(vi.fn().mockResolvedValue(false));
  fetchMock.mockResolvedValueOnce(unauthenticated());
  expect((await fetchResponse("/admin/x")).status).toBe(401);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("a dropped connection becomes a network error and an abort a REQUEST_ABORTED error", async () => {
  fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await expect(fetchResponse("/admin/x")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  const controller = new AbortController();
  controller.abort();
  fetchMock.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
  await expect(fetchResponse("/admin/x", { signal: controller.signal })).rejects.toMatchObject({
    code: "REQUEST_ABORTED",
  });
});
