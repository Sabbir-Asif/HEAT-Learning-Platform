import { revalidatePath, revalidateSecretHeader } from "@heat/contracts";
import { afterEach, describe, expect, test, vi } from "vitest";
import { HttpNewsRevalidation, revalidationTimeoutMs } from "../../src/news/http-news-revalidation";

const target = { url: "https://site.example.test/base/", secret: "s3cret" };

const stubFetch = (response: Response) => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HttpNewsRevalidation", () => {
  test("posts the tags with the secret header to the revalidate path", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 200 }));

    await new HttpNewsRevalidation(target).revalidate(["news", "news:post-1"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(new URL(revalidatePath, target.url).toString());
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      "content-type": "application/json",
      [revalidateSecretHeader]: "s3cret",
    });
    expect(JSON.parse(String(init?.body))).toEqual({ tags: ["news", "news:post-1"] });
    expect(init?.redirect).toBe("manual");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  test("bounds the request with a timeout", () => {
    expect(revalidationTimeoutMs).toBe(3000);
  });

  test("throws without calling out when the secret is not set", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 200 }));

    await expect(
      new HttpNewsRevalidation({ url: target.url, secret: undefined }).revalidate(["news"]),
    ).rejects.toThrow("REVALIDATE_SECRET is not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("throws with the status when the site refuses", async () => {
    stubFetch(new Response(null, { status: 403 }));

    await expect(new HttpNewsRevalidation(target).revalidate(["news"])).rejects.toThrow(
      "Revalidation answered 403",
    );
  });

  test("treats a manual redirect as a failure", async () => {
    stubFetch(new Response(null, { status: 307 }));

    await expect(new HttpNewsRevalidation(target).revalidate(["news"])).rejects.toThrow(
      "Revalidation answered 307",
    );
  });

  test("passes a network failure through", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("connect refused")));

    await expect(new HttpNewsRevalidation(target).revalidate(["news"])).rejects.toThrow(
      "connect refused",
    );
  });
});
