import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { RichTextRenderer } from "../src/content";
import type { RichTextDocument } from "../src/content";

afterEach(cleanup);

const assetId = "0198f1a0-0000-7000-8000-0000000000a1";

const document: RichTextDocument = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Why" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Bold", marks: [{ type: "bold" }, { type: "italic" }] },
        { type: "hardBreak" },
        {
          type: "text",
          text: "Safe",
          marks: [{ type: "link", attrs: { href: "https://a.test" } }],
        },
        {
          type: "text",
          text: "Unsafe",
          marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }],
        },
      ],
    },
    {
      type: "blockquote",
      content: [{ type: "paragraph", content: [{ type: "text", text: "q" }] }],
    },
    { type: "image", attrs: { assetId, alt: "A poster" } },
  ],
};

describe("RichTextRenderer", () => {
  test("renders allow-listed elements one heading level below the page", () => {
    const { container } = render(
      <RichTextRenderer
        document={document}
        images={[{ assetId, url: "/media/public/x/w640.webp", alt: "A poster" }]}
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Why" })).toBeTruthy();
    expect(container.querySelector("strong em, em strong")).not.toBeNull();
    expect(container.querySelector("ul > li")).not.toBeNull();
    expect(container.querySelector("blockquote")).not.toBeNull();
    expect(screen.getByRole("img", { name: "A poster" }).getAttribute("src")).toBe(
      "/media/public/x/w640.webp",
    );
  });

  test("keeps only https and mailto links and sets a safe rel", () => {
    const { container } = render(<RichTextRenderer document={document} />);
    const links = [...container.querySelectorAll("a")];
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["https://a.test"]);
    expect(links[0]?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("Unsafe")).toBeTruthy();
  });

  test("skips an image whose asset is unknown", () => {
    const { container } = render(<RichTextRenderer document={document} />);
    expect(container.querySelector("img")).toBeNull();
  });

  test("never emits script elements or inline handlers for hostile text", () => {
    const hostile: RichTextDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "<script>alert(1)</script><img onerror=x>" }],
        },
      ],
    };
    const { container } = render(<RichTextRenderer document={hostile} />);
    expect(container.querySelector("script, img")).toBeNull();
    expect(container.textContent).toContain("<script>");
  });
});
