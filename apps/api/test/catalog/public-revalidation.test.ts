import { afterEach, describe, expect, test, vi } from "vitest";
import { HttpPublicRevalidation } from "../../src/catalog/public-revalidation";

const config = (secret: string | undefined) =>
  ({ revalidation: { url: "http://frontend-public:3000", secret } }) as never;

afterEach(() => vi.unstubAllGlobals());

describe("HttpPublicRevalidation", () => {
  test("posts the distinct tags with the secret header to the internal address", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await new HttpPublicRevalidation(config("s".repeat(40))).revalidate([
      "front-page",
      "front-page",
      "course:heat",
    ]);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("http://frontend-public:3000/api/revalidate");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(init.headers).toMatchObject({ "x-revalidate-secret": "s".repeat(40) });
    expect(JSON.parse(String(init.body))).toEqual({ tags: ["front-page", "course:heat"] });
  });

  test("does nothing without tags or without a configured secret", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await new HttpPublicRevalidation(config("s".repeat(40))).revalidate([]);
    await new HttpPublicRevalidation(config(undefined)).revalidate(["front-page"]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("fails when the public app refuses the request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    await expect(
      new HttpPublicRevalidation(config("s".repeat(40))).revalidate(["landing"]),
    ).rejects.toThrow("Revalidation answered 401");
  });
});
