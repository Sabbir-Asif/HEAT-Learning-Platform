import { describe, expect, test } from "vitest";
import {
  isSafeRichTextHref,
  parseRichText,
  richTextImageIds,
  richTextTextChanges,
  sameRichTextStructure,
} from "../src/index";
import type { RichTextDoc } from "../src/index";

const assetId = "0198f1a0-0000-7000-8000-0000000000a1";
const otherAsset = "0198f1a0-0000-7000-8000-0000000000a2";

const text = (value: string, href?: string) =>
  href === undefined
    ? { type: "text", text: value }
    : { type: "text", text: value, marks: [{ type: "link", attrs: { href } }] };

const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });

const doc = (...content: unknown[]) => ({ type: "doc", content });

const parsed = (value: unknown): RichTextDoc => {
  const result = parseRichText(value);
  if (!result.ok) throw new Error(result.issue);
  return result.doc;
};

describe("parseRichText", () => {
  test("accepts every allow-listed node and mark", () => {
    const value = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("Title")] },
      paragraph(
        { type: "text", text: "Bold", marks: [{ type: "bold" }, { type: "italic" }] },
        { type: "hardBreak" },
        text("Link", "https://example.com/a"),
        text("Mail", "mailto:help@example.com"),
      ),
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [paragraph(text("Item"))] }],
      },
      {
        type: "orderedList",
        content: [{ type: "listItem", content: [paragraph(text("Item"))] }],
      },
      { type: "blockquote", content: [paragraph(text("Quote"))] },
      { type: "image", attrs: { assetId, alt: "A poster" } },
    );
    expect(parseRichText(value).ok).toBe(true);
  });

  test.each([
    ["an unknown node type", doc({ type: "script", content: [] }), "unknown-node"],
    ["an iframe", doc({ type: "iframe", attrs: { src: "https://example.com" } }), "unknown-node"],
    ["a javascript link", doc(paragraph(text("x", "javascript:alert(1)"))), "bad-link"],
    ["a data link", doc(paragraph(text("x", "data:text/html,hi"))), "bad-link"],
    ["a http link", doc(paragraph(text("x", "http://example.com"))), "bad-link"],
    ["a relative link", doc(paragraph(text("x", "/admin"))), "bad-link"],
    [
      "an unknown mark",
      doc(paragraph({ type: "text", text: "x", marks: [{ type: "code" }] })),
      "unknown-mark",
    ],
    ["a stray key", doc({ type: "paragraph", content: [], onclick: "x" }), "unknown-key"],
    [
      "a heading level 1",
      doc({ type: "heading", attrs: { level: 1 }, content: [text("x")] }),
      "bad-attrs",
    ],
    [
      "an image without alt text",
      doc({ type: "image", attrs: { assetId, alt: "  " } }),
      "missing-alt",
    ],
    [
      "an image with a bad asset id",
      doc({ type: "image", attrs: { assetId: "x", alt: "a" } }),
      "bad-attrs",
    ],
    [
      "a list outside list items",
      doc({ type: "bulletList", content: [paragraph(text("x"))] }),
      "bad-content",
    ],
    ["empty text", doc(paragraph({ type: "text", text: "" })), "bad-content"],
  ])("rejects %s", (_name, value, issue) => {
    expect(parseRichText(value)).toEqual({ ok: false, issue });
  });

  test("rejects a document nested too deeply", () => {
    let node: unknown = paragraph(text("x"));
    for (let level = 0; level < 10; level += 1) {
      node = { type: "blockquote", content: [node] };
    }
    expect(parseRichText(doc(node))).toEqual({ ok: false, issue: "too-deep" });
  });

  test("rejects a non-object", () => {
    expect(parseRichText("text")).toEqual({ ok: false, issue: "not-an-object" });
  });
});

describe("isSafeRichTextHref", () => {
  test.each([
    ["https://example.com", true],
    ["mailto:a@b.co", true],
    ["JAVASCRIPT:alert(1)", false],
    ["java\nscript:alert(1)", false],
    ["ftp://example.com", false],
    ["", false],
  ])("%s -> %s", (href, expected) => {
    expect(isSafeRichTextHref(href)).toBe(expected);
  });
});

describe("sameRichTextStructure", () => {
  const same = (before: unknown, after: unknown) =>
    sameRichTextStructure(parsed(before), parsed(after));

  test("allows a wording change in a paragraph", () => {
    expect(same(doc(paragraph(text("Helo"))), doc(paragraph(text("Hello there"))))).toBe(true);
  });

  test("allows changed link text with the same target", () => {
    const before = doc(paragraph(text("See "), text("guide", "https://example.com")));
    const after = doc(paragraph(text("Read the "), text("full guide", "https://example.com")));
    expect(same(before, after)).toBe(true);
  });

  test("allows formatting changes inside a run of text", () => {
    const before = doc(paragraph(text("one two")));
    const after = doc(
      paragraph(text("one "), { type: "text", text: "two", marks: [{ type: "bold" }] }),
    );
    expect(same(before, after)).toBe(true);
  });

  test("refuses a split paragraph", () => {
    expect(same(doc(paragraph(text("a b"))), doc(paragraph(text("a")), paragraph(text("b"))))).toBe(
      false,
    );
  });

  test("refuses a changed link target", () => {
    expect(
      same(
        doc(paragraph(text("x", "https://example.com/a"))),
        doc(paragraph(text("x", "https://example.com/b"))),
      ),
    ).toBe(false);
  });

  test("refuses a removed link", () => {
    expect(same(doc(paragraph(text("x", "https://example.com"))), doc(paragraph(text("x"))))).toBe(
      false,
    );
  });

  test("refuses an added or swapped image", () => {
    const image = (id: string) => ({ type: "image", attrs: { assetId: id, alt: "a" } });
    expect(same(doc(paragraph(text("x"))), doc(paragraph(text("x")), image(assetId)))).toBe(false);
    expect(same(doc(image(assetId)), doc(image(otherAsset)))).toBe(false);
    expect(
      same(doc(image(assetId)), doc({ ...image(assetId), attrs: { assetId, alt: "b" } })),
    ).toBe(true);
  });

  test("refuses a paragraph turned into a heading or a heading level change", () => {
    const heading = (level: number) => ({
      type: "heading",
      attrs: { level },
      content: [text("x")],
    });
    expect(same(doc(paragraph(text("x"))), doc(heading(2)))).toBe(false);
    expect(same(doc(heading(2)), doc(heading(3)))).toBe(false);
  });
});

describe("richTextTextChanges", () => {
  test("lists only the changed blocks", () => {
    const before = parsed(doc(paragraph(text("Same")), paragraph(text("Helo"))));
    const after = parsed(doc(paragraph(text("Same")), paragraph(text("Hello"))));
    expect(richTextTextChanges(before, after)).toEqual([
      { block: 2, before: "Helo", after: "Hello" },
    ]);
  });
});

describe("richTextImageIds", () => {
  test("finds images nested in lists and quotes", () => {
    const value = parsed(
      doc({
        type: "blockquote",
        content: [{ type: "image", attrs: { assetId, alt: "a" } }],
      }),
    );
    expect(richTextImageIds(value)).toEqual([assetId]);
  });
});
