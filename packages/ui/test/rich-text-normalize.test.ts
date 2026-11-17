import { describe, expect, test } from "vitest";
import { normalizeEditorDocument } from "../src/editor";

const assetId = "0198f1a0-0000-7000-8000-0000000000a1";

describe("normalizeEditorDocument", () => {
  test("strips editor-only attributes and unknown marks", () => {
    const result = normalizeEditorDocument({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: null },
          content: [
            {
              type: "text",
              text: "Link",
              marks: [
                {
                  type: "link",
                  attrs: { href: "https://a.test", target: "_blank", rel: "x", class: null },
                },
                { type: "underline" },
              ],
            },
          ],
        },
      ],
    });
    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Link",
              marks: [{ type: "link", attrs: { href: "https://a.test" } }],
            },
          ],
        },
      ],
    });
  });

  test("drops unsafe links, unknown nodes, empty lists and images without alt text", () => {
    const result = normalizeEditorDocument({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "x",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
        { type: "codeBlock", content: [{ type: "text", text: "x" }] },
        { type: "bulletList", content: [] },
        { type: "image", attrs: { assetId, alt: " " } },
        { type: "image", attrs: { assetId, alt: "Poster", src: "x", title: null } },
      ],
    });
    expect(result.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "x" }] },
      { type: "image", attrs: { assetId, alt: "Poster" } },
    ]);
  });

  test("returns an empty document for anything that is not a document", () => {
    expect(normalizeEditorDocument(null)).toEqual({ type: "doc", content: [] });
  });
});
