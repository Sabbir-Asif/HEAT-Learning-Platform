import { describe, expect, test } from "vitest";
import { createHttpAdapter, trustedProxyHops } from "../../src/http/http-adapter";

describe("createHttpAdapter", () => {
  test("configures Express for case sensitive, strict routing and one trusted proxy hop", () => {
    const express = createHttpAdapter().getInstance() as {
      enabled(name: string): boolean;
      get(name: string): unknown;
      router: { caseSensitive: boolean; strict: boolean };
    };

    expect(express.enabled("case sensitive routing")).toBe(true);
    expect(express.enabled("strict routing")).toBe(true);
    expect(express.router.caseSensitive).toBe(true);
    expect(express.router.strict).toBe(true);
    expect(express.get("trust proxy")).toBe(trustedProxyHops);
    expect(trustedProxyHops).toBe(1);
  });
});

describe("request id middleware", () => {
  test("replaces a client-sent x-request-id with a generated UUID on the request and response", () => {
    const express = createHttpAdapter().getInstance() as {
      router: { stack: { name: string; handle: (...args: unknown[]) => void }[] };
    };
    const layer = express.router.stack.at(-1);
    const request = { headers: { "x-request-id": "client-chosen" } as Record<string, string> };
    const sent: Record<string, string> = {};
    let called = false;
    layer?.handle(
      request,
      { setHeader: (name: string, value: string) => (sent[name] = value) },
      () => (called = true),
    );
    expect(called).toBe(true);
    expect(request.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent["x-request-id"]).toBe(request.headers["x-request-id"]);
  });
});
