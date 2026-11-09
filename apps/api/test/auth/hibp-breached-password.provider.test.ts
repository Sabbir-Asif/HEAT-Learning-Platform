import { afterEach, describe, expect, test, vi } from "vitest";
import { HibpBreachedPasswordProvider } from "../../src/auth/hibp-breached-password.provider";
import { testConfig } from "../support/auth-fixtures";

afterEach(() => vi.unstubAllGlobals());

describe("HibpBreachedPasswordProvider", () => {
  test("requests the range with padding and returns the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ABC:1", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const body = await new HibpBreachedPasswordProvider(testConfig()).fetchRange("21BD1");

    expect(body).toBe("ABC:1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.pwnedpasswords.com/range/21BD1");
    expect(init.headers).toEqual({ "Add-Padding": "true" });
  });

  test("joins a base URL without a trailing slash", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const config = testConfig({ BREACHED_PASSWORD_RANGE_URL: "https://hibp.test/range" });

    await new HibpBreachedPasswordProvider(config).fetchRange("AAAAA");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://hibp.test/range/AAAAA");
  });

  test("throws on a non-success status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 503 })));

    await expect(
      new HibpBreachedPasswordProvider(testConfig()).fetchRange("AAAAA"),
    ).rejects.toThrow("status 503");
  });
});
