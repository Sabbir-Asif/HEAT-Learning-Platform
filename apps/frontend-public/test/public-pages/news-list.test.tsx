import type { NewsPublicListResponse } from "@heat/contracts";
import { describe, expect, test, vi } from "vitest";
import { newsPageFromParam, newsPageHref } from "../../src/public-pages/links";
import { NewsList } from "../../src/public-pages/news-list";
import { mount } from "../learn/mount";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const list = (overrides: Partial<NewsPublicListResponse> = {}): NewsPublicListResponse => ({
  items: [
    {
      slug: "orientation",
      title: "Orientation week",
      summary: "Welcome back.",
      publishedAt: "2026-11-10T06:00:00.000Z",
      cover: null,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
  ...overrides,
});

describe("NewsList", () => {
  test("links each post to its article", async () => {
    const view = await mount(<NewsList news={list()} />);

    expect(view.querySelector("a[href='/news/orientation']")?.textContent).toBe("Orientation week");
    expect(view.textContent).toContain("Welcome back.");
    expect(view.querySelector("nav")).toBeNull();
  });

  test("shows an empty state when nothing is published", async () => {
    const view = await mount(<NewsList news={list({ items: [], total: 0 })} />);

    expect(view.querySelector('[data-slot="empty-state"]')?.textContent).toContain("No news yet");
  });

  test("offers older posts from the first page and newer posts from the next", async () => {
    const first = await mount(<NewsList news={list({ total: 25 })} />);
    expect(first.querySelector("a[href='/news?page=2']")?.textContent).toBe("Older posts");

    const second = await mount(<NewsList news={list({ total: 25, page: 2 })} />);
    expect(second.querySelector("a[href='/news']")?.textContent).toBe("Newer posts");
    expect(second.querySelector("a[href='/news?page=3']")?.textContent).toBe("Older posts");
  });
});

describe("news paging links", () => {
  test("the first page has no query", () => {
    expect(newsPageHref(1)).toBe("/news");
    expect(newsPageHref(3)).toBe("/news?page=3");
  });

  test("reads a safe page number from the query", () => {
    expect(newsPageFromParam("2")).toBe(2);
    expect(newsPageFromParam(["4", "5"])).toBe(4);
    expect(newsPageFromParam("0")).toBe(1);
    expect(newsPageFromParam("abc")).toBe(1);
    expect(newsPageFromParam(undefined)).toBe(1);
  });
});
