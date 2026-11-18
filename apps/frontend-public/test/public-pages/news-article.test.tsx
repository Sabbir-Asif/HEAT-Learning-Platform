import type { NewsPublicPost } from "@heat/contracts";
import { describe, expect, test, vi } from "vitest";
import { NewsArticle } from "../../src/public-pages/news-article";
import { mount } from "../learn/mount";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const assetId = "0198f1a0-0000-7000-8000-0000000000a1";

const post = (body: unknown): NewsPublicPost => ({
  slug: "orientation",
  title: "Orientation week",
  publishedAt: "2026-11-10T06:00:00.000Z",
  schemaVersion: 1,
  body: body as Record<string, unknown>,
  images: [{ assetId, url: "/media/public/a/w640.webp", alt: "Hall" }],
});

const withLink = (href: string) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Read more", marks: [{ type: "link", attrs: { href } }] }],
    },
  ],
});

describe("NewsArticle", () => {
  test("shows the title, the Dhaka date and the body", async () => {
    const view = await mount(<NewsArticle post={post(withLink("https://du.ac.bd"))} />);

    expect(view.querySelector("h1")?.textContent).toBe("Orientation week");
    expect(view.querySelector("time")?.textContent).toBe("10 November 2026");
    expect(view.querySelector("a[href='https://du.ac.bd']")?.textContent).toBe("Read more");
  });

  test("renders no body at all for a javascript link, since the contract rejects the whole document", async () => {
    const view = await mount(<NewsArticle post={post(withLink("javascript:alert(1)"))} />);

    expect(view.querySelector("a[href^='javascript']")).toBeNull();
    expect(view.textContent).not.toContain("Read more");
    expect(view.querySelector("h1")?.textContent).toBe("Orientation week");
  });

  test("renders an unparsable body as an empty article without injecting markup", async () => {
    const view = await mount(
      <NewsArticle
        post={post({ type: "doc", content: [{ type: "html", html: "<script>x</script>" }] })}
      />,
    );

    expect(view.querySelector("script")).toBeNull();
    expect(view.textContent).not.toContain("<script>");
  });
});
