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
