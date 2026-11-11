import { describe, expect, test } from "vitest";
import {
  ApiError,
  abortedError,
  isApiError,
  networkError,
  parseErrorResponse,
  unexpectedResponseError,
} from "../src/errors";

const envelope = (code: string, extra: object = {}) =>
  JSON.stringify({ error: { code, message: "Server text", requestId: "req-1", ...extra } });

describe("parseErrorResponse", () => {
  test("turns an envelope into an ApiError with status, code, fields and request id", async () => {
    const response = new Response(
      envelope("VALIDATION_FAILED", { fields: [{ path: "email", code: "invalid_format" }] }),
      { status: 400 },
    );
    const error = await parseErrorResponse(response);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      name: "ApiError",
      status: 400,
      code: "VALIDATION_FAILED",
      fields: [{ path: "email", code: "invalid_format" }],
      requestId: "req-1",
    });
  });

  test("keeps the failure messages of a rejected action", async () => {
    const response = new Response(
      envelope("COURSE_PUBLISH_CHECKS_FAILED", { failures: ["Module 1 has no ready video."] }),
      { status: 422 },
    );
    expect((await parseErrorResponse(response)).failures).toEqual(["Module 1 has no ready video."]);
  });

  test("keeps the next attempt time of a waiting quiz", async () => {
    const response = new Response(
      envelope("QUIZ_ATTEMPT_WAIT", { details: { nextAttemptAt: "2026-11-12T10:05:00.000Z" } }),
      { status: 409 },
    );
    expect((await parseErrorResponse(response)).details).toEqual({
      nextAttemptAt: "2026-11-12T10:05:00.000Z",
    });
  });

  test("never uses the server message as the error message", async () => {
    const error = await parseErrorResponse(new Response(envelope("FORBIDDEN"), { status: 403 }));
    expect(error.message).toBe("FORBIDDEN");
    expect(error.message).not.toContain("Server text");
  });

  test("keeps 401 and 403 with their codes", async () => {
    const unauthenticated = await parseErrorResponse(
      new Response(envelope("UNAUTHENTICATED"), { status: 401 }),
    );
    expect([unauthenticated.status, unauthenticated.code]).toEqual([401, "UNAUTHENTICATED"]);
    const forbidden = await parseErrorResponse(
      new Response(envelope("FORBIDDEN"), { status: 403 }),
    );
    expect([forbidden.status, forbidden.code]).toEqual([403, "FORBIDDEN"]);
  });

  test("keeps Retry-After in seconds on a 429", async () => {
    const error = await parseErrorResponse(
      new Response(envelope("RATE_LIMITED"), { status: 429, headers: { "Retry-After": "30" } }),
    );
    expect(error.retryAfterSeconds).toBe(30);
  });

  test("reads Retry-After given as an HTTP date", async () => {
    const date = new Date(Date.now() + 90_000).toUTCString();
    const error = await parseErrorResponse(
      new Response(envelope("RATE_LIMITED"), { status: 429, headers: { "Retry-After": date } }),
    );
    expect(error.retryAfterSeconds).toBeGreaterThan(80);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(90);
  });

  test("ignores a Retry-After it cannot read", async () => {
    const error = await parseErrorResponse(
      new Response(envelope("RATE_LIMITED"), { status: 429, headers: { "Retry-After": "soon" } }),
    );
    expect(error.retryAfterSeconds).toBeUndefined();
  });

  test.each([
    ["an HTML error page from a proxy", "<html><body>502 Bad Gateway secret-detail</body></html>"],
    ["an empty body", ""],
    ["JSON that is not an envelope", JSON.stringify({ message: "nope secret-detail" })],
    ["an envelope with a code this client does not know", envelope("FROM_THE_FUTURE")],
  ])("%s gives UNEXPECTED_RESPONSE with the status and none of the body", async (_name, body) => {
    const error = await parseErrorResponse(new Response(body, { status: 502 }));
    expect(error).toMatchObject({ status: 502, code: "UNEXPECTED_RESPONSE", fields: [] });
    expect(error.message).toBe("UNEXPECTED_RESPONSE");
    expect(JSON.stringify(error)).not.toContain("secret-detail");
  });

  test("a body that cannot be read gives UNEXPECTED_RESPONSE", async () => {
    const response = new Response("x", { status: 500 });
    Object.defineProperty(response, "text", {
      value: () => Promise.reject(new TypeError("stream failed")),
    });
    expect((await parseErrorResponse(response)).code).toBe("UNEXPECTED_RESPONSE");
  });
});

describe("client-side errors", () => {
  test("network failure has status 0 and no cause that could leak", () => {
    const error = networkError();
    expect(error).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
    expect(error.cause).toBeUndefined();
  });

  test("an abort has its own code", () => {
    expect(abortedError()).toMatchObject({ status: 0, code: "REQUEST_ABORTED" });
  });

  test("an unreadable success body keeps the status", () => {
    expect(unexpectedResponseError(200)).toMatchObject({
      status: 200,
      code: "UNEXPECTED_RESPONSE",
    });
  });

  test("isApiError tells ApiError from other errors", () => {
    expect(isApiError(networkError())).toBe(true);
    expect(isApiError(new Error("x"))).toBe(false);
    expect(isApiError("x")).toBe(false);
  });
});
