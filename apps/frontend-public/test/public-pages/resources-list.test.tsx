import type { ResourcePublicListResponse } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import { ResourcesList } from "../../src/public-pages/resources-list";
import { mount } from "../learn/mount";

const list = (items: ResourcePublicListResponse["items"]): ResourcePublicListResponse => ({
  items,
});

describe("ResourcesList", () => {
  test("offers a file as a download with its type and size", async () => {
    const view = await mount(
      <ResourcesList
        resources={list([
          {
            id: "r1",
            kind: "file",
            title: "Slides",
            description: null,
            url: "/media/public/2026/11/abc/original.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2048,
          },
        ])}
      />,
    );

    const link = view.querySelector("a[download]");
    expect(link?.getAttribute("href")).toBe("/media/public/2026/11/abc/original.pdf");
    expect(view.textContent).toContain("PDF, 2 KB");
  });

  test("opens a link in a new tab without leaking the opener", async () => {
    const view = await mount(
      <ResourcesList
        resources={list([
          {
            id: "r2",
            kind: "link",
            title: "Guide",
            description: "Read first",
            url: "https://example.org/guide",
            mimeType: null,
            sizeBytes: null,
          },
        ])}
      />,
    );

    const link = view.querySelector("a[href='https://example.org/guide']");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(view.textContent).toContain("Read first");
  });

  test("shows an empty state when nothing is published", async () => {
    const view = await mount(<ResourcesList resources={list([])} />);

    expect(view.querySelector('[data-slot="empty-state"]')?.textContent).toContain(
      "No resources yet",
    );
  });
});
