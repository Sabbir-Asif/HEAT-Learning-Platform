import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const revalidateTag = vi.fn();

vi.mock("next/cache", () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }));

const secret = "r".repeat(40);

const post = async (body: unknown, headers: Record<string, string> = {}) => {
  const { POST } = await import("../../src/app/api/revalidate/route");
  return POST(
    new Request("http://frontend-public:3000/api/revalidate", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
};

beforeEach(() => {
  revalidateTag.mockReset();
  vi.stubEnv("REVALIDATE_SECRET", secret);
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/revalidate", () => {
  test("revalidates each distinct tag with the max profile for the right secret", async () => {
    const response = await post(
      { tags: ["front-page", "course:heat", "front-page"] },
      { "x-revalidate-secret": secret },
    );

    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledTimes(2);
    expect(revalidateTag).toHaveBeenCalledWith("front-page", "max");
    expect(revalidateTag).toHaveBeenCalledWith("course:heat", "max");
  });

  test("refuses without the secret and revalidates nothing", async () => {
    const missing = await post({ tags: ["front-page"] });
    const wrong = await post({ tags: ["front-page"] }, { "x-revalidate-secret": "nope" });

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  test("refuses a request that came through the proxy", async () => {
    const response = await post(
      { tags: ["front-page"] },
      { "x-revalidate-secret": secret, "x-forwarded-for": "203.0.113.9" },
    );

    expect(response.status).toBe(403);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  test("refuses everything when the secret is not configured", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "");

    const response = await post({ tags: ["front-page"] }, { "x-revalidate-secret": "" });

    expect(response.status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  test("rejects an unknown tag, an empty list and a body that is not JSON", async () => {
    const headers = { "x-revalidate-secret": secret };

    expect((await post({ tags: ["other"] }, headers)).status).toBe(400);
    expect((await post({ tags: [] }, headers)).status).toBe(400);
    expect((await post("not json", headers)).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
