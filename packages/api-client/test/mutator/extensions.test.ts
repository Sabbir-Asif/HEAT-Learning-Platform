import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { customFetch } from "../../src/mutator/custom-fetch";
import { registerRequestInterceptor, setUnauthorizedHandler } from "../../src/mutator/extensions";

const fetchMock = vi.fn<typeof fetch>();
const calls: string[] = [];

const envelope = (code: string, status: number) =>
  new Response(JSON.stringify({ error: { code, message: "x", requestId: "r" } }), { status });
const ok = () => new Response(JSON.stringify({ status: "ok" }), { status: 200 });

beforeEach(() => {
  calls.length = 0;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  setUnauthorizedHandler(undefined);
  vi.unstubAllGlobals();
});

test("with nothing registered, a request is sent unchanged", async () => {
  fetchMock.mockResolvedValueOnce(ok());
  await expect(customFetch("/api/health", { method: "GET" })).resolves.toEqual({ status: "ok" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("with nothing registered, a 401 is thrown as it is", async () => {
  fetchMock.mockResolvedValueOnce(envelope("UNAUTHENTICATED", 401));
  await expect(customFetch("/api/health")).rejects.toMatchObject({
    status: 401,
    code: "UNAUTHENTICATED",
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("interceptors run in registration order, before the request, and can change it", async () => {
  const removeFirst = registerRequestInterceptor((request) => {
    calls.push("first");
    const headers = new Headers(request.init.headers);
    headers.set("x-test", "1");
    return { ...request, init: { ...request.init, headers } };
  });
  const removeSecond = registerRequestInterceptor(async (request) => {
    calls.push("second");
    const headers = new Headers(request.init.headers);
    headers.set("x-test", `${headers.get("x-test")}+2`);
    return { ...request, init: { ...request.init, headers } };
  });
  fetchMock.mockImplementationOnce(async (_url, init) => {
    calls.push("fetch");
    expect(new Headers(init?.headers).get("x-test")).toBe("1+2");
    return ok();
  });
  await customFetch("/api/health");
  expect(calls).toEqual(["first", "second", "fetch"]);
  removeFirst();
  removeSecond();
});

test("a removed interceptor no longer runs", async () => {
  const remove = registerRequestInterceptor((request) => {
    calls.push("interceptor");
    return request;
  });
  remove();
  fetchMock.mockResolvedValueOnce(ok());
  await customFetch("/api/health");
  expect(calls).toEqual([]);
});

test("on 401 the handler is called after the request, and a true answer retries once through the interceptors", async () => {
  const remove = registerRequestInterceptor((request) => {
    calls.push("interceptor");
    return request;
  });
  setUnauthorizedHandler(async (error) => {
    calls.push(`handler ${error.status}`);
    return true;
  });
  fetchMock
    .mockImplementationOnce(async () => {
      calls.push("fetch 1");
      return envelope("UNAUTHENTICATED", 401);
    })
    .mockImplementationOnce(async () => {
      calls.push("fetch 2");
      return ok();
    });
  await expect(customFetch("/api/health")).resolves.toEqual({ status: "ok" });
  expect(calls).toEqual(["interceptor", "fetch 1", "handler 401", "interceptor", "fetch 2"]);
  remove();
});

test("a false answer from the handler throws the original 401 without retrying", async () => {
  setUnauthorizedHandler(() => false);
  fetchMock.mockResolvedValueOnce(envelope("UNAUTHENTICATED", 401));
  await expect(customFetch("/api/health")).rejects.toMatchObject({ status: 401 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("a second 401 after the retry is thrown and the handler is not asked again", async () => {
  const handler = vi.fn(() => true);
  setUnauthorizedHandler(handler);
  fetchMock
    .mockResolvedValueOnce(envelope("UNAUTHENTICATED", 401))
    .mockResolvedValueOnce(envelope("UNAUTHENTICATED", 401));
  await expect(customFetch("/api/health")).rejects.toMatchObject({ status: 401 });
  expect(handler).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("other errors do not reach the 401 handler", async () => {
  const handler = vi.fn(() => true);
  setUnauthorizedHandler(handler);
  fetchMock.mockResolvedValueOnce(envelope("FORBIDDEN", 403));
  await expect(customFetch("/api/health")).rejects.toMatchObject({ status: 403 });
  expect(handler).not.toHaveBeenCalled();
});

test("removing an interceptor twice is harmless", async () => {
  const remove = registerRequestInterceptor((request) => request);
  remove();
  expect(() => remove()).not.toThrow();
});
