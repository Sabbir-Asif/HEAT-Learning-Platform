import { describe, expect, test } from "vitest";
import {
  isSafeRichTextHref,
  parseRichText,
  richTextBodySchema,
  richTextImageIds,
  richTextMaxDepth,
  richTextMaxNodes,
  richTextMaxTextLength,
  richTextStructure,
  richTextTextChanges,
  sameRichTextStructure,
} from "../src/index";
import type { RichTextDoc } from "../src/index";

const asset = "0198f1a0-0000-7000-8000-0000000000a1";
const text = (value: string, marks?: unknown[]) =>
  marks === undefined ? { type: "text", text: value } : { type: "text", text: value, marks };
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const doc = (...content: unknown[]) => ({ type: "doc", content });
const issueOf = (value: unknown) => {
  const result = parseRichText(value);
  return result.ok ? "ok" : result.issue;
};
const ok = (value: unknown): RichTextDoc => {
  const result = parseRichText(value);
  if (!result.ok) throw new Error(result.issue);
  return result.doc;
};

describe("parseRichText rejections", () => {
  test.each([
    ["a non-object", "text", "not-an-object"],
    ["an array", [], "not-an-object"],
    ["null", null, "not-an-object"],
    ["a wrong root type", { type: "page", content: [] }, "unknown-node"],
    ["an extra root key", { type: "doc", content: [], extra: 1 }, "unknown-key"],
    ["non-array content", { type: "doc", content: "x" }, "bad-content"],
    ["a child that is not an object", doc("x"), "unknown-node"],
    ["a child without a string type", doc({ type: 3 }), "unknown-node"],
    ["an unknown child type", doc({ type: "script" }), "unknown-node"],
    ["an inline node at block level", doc(text("x")), "bad-content"],
    [
      "a list item at block level",
      doc({ type: "listItem", content: [paragraph()] }),
      "bad-content",
    ],
    ["empty text", doc(paragraph(text(""))), "bad-content"],
    ["non-string text", doc(paragraph({ type: "text", text: 4 })), "bad-content"],
    ["extra text keys", doc(paragraph({ type: "text", text: "a", x: 1 })), "unknown-key"],
    ["non-array marks", doc(paragraph({ type: "text", text: "a", marks: "bold" })), "unknown-mark"],
    ["a non-object mark", doc(paragraph(text("a", ["bold"]))), "unknown-mark"],
    ["an unknown mark", doc(paragraph(text("a", [{ type: "underline" }]))), "unknown-mark"],
    ["extra mark keys", doc(paragraph(text("a", [{ type: "bold", x: 1 }]))), "unknown-key"],
    ["a link without attrs", doc(paragraph(text("a", [{ type: "link" }]))), "bad-link"],
    [
      "a link with extra attrs",
      doc(paragraph(text("a", [{ type: "link", attrs: { href: "https://a.com", rel: "x" } }]))),
      "unknown-key",
    ],
    [
      "a link with a non-string href",
      doc(paragraph(text("a", [{ type: "link", attrs: { href: 3 } }]))),
      "bad-link",
    ],
    [
      "a javascript link",
      doc(paragraph(text("a", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))),
      "bad-link",
    ],
    ["hardBreak with content", doc(paragraph({ type: "hardBreak", content: [] })), "unknown-key"],
    ["paragraph with attrs", doc({ type: "paragraph", attrs: {} }), "unknown-key"],
    ["paragraph with non-array content", doc({ type: "paragraph", content: {} }), "bad-content"],
    ["paragraph with block child", doc(paragraph(paragraph())), "bad-content"],
    ["heading without attrs", doc({ type: "heading" }), "bad-attrs"],
    [
      "heading with extra attrs",
      doc({ type: "heading", attrs: { level: 2, id: "a" } }),
      "unknown-key",
    ],
    ["heading level 1", doc({ type: "heading", attrs: { level: 1 } }), "bad-attrs"],
    ["heading level 5", doc({ type: "heading", attrs: { level: 5 } }), "bad-attrs"],
    ["a list without content", doc({ type: "bulletList" }), "bad-content"],
    ["an empty ordered list", doc({ type: "orderedList", content: [] }), "bad-content"],
    ["a list with a non-item", doc({ type: "bulletList", content: [paragraph()] }), "bad-content"],
    [
      "a list item without content",
      doc({ type: "bulletList", content: [{ type: "listItem" }] }),
      "bad-content",
    ],
    ["an empty blockquote", doc({ type: "blockquote", content: [] }), "bad-content"],
    [
      "a blockquote with inline child",
      doc({ type: "blockquote", content: [text("x")] }),
      "bad-content",
    ],
    ["an image without attrs", doc({ type: "image" }), "bad-attrs"],
    [
      "an image with extra attrs",
      doc({ type: "image", attrs: { assetId: asset, alt: "a", w: 1 } }),
      "unknown-key",
    ],
    [
      "an image with a bad id",
      doc({ type: "image", attrs: { assetId: "nope", alt: "a" } }),
      "bad-attrs",
    ],
    [
      "an image with a non-string id",
      doc({ type: "image", attrs: { assetId: 1, alt: "a" } }),
      "bad-attrs",
    ],
    [
      "an image with blank alt",
      doc({ type: "image", attrs: { assetId: asset, alt: "  " } }),
      "missing-alt",
    ],
    [
      "an image with non-string alt",
      doc({ type: "image", attrs: { assetId: asset, alt: 1 } }),
      "missing-alt",
    ],
    [
      "an image with long alt",
      doc({ type: "image", attrs: { assetId: asset, alt: "a".repeat(301) } }),
      "bad-attrs",
    ],
  ])("rejects %s", (_name, value, issue) => {
    expect(issueOf(value)).toBe(issue);
  });

  test("accepts a doc without content as empty", () => {
    expect(ok({ type: "doc" })).toEqual({ type: "doc", content: [] });
  });

  test("keeps a paragraph and heading without content and drops empty marks", () => {
    const parsed = ok(doc({ type: "paragraph" }));
    expect(parsed.content).toEqual([{ type: "paragraph" }]);
    const marked = ok(doc(paragraph(text("a", []))));
    expect(marked.content).toEqual([{ type: "paragraph", content: [{ type: "text", text: "a" }] }]);
    const heading = ok(doc({ type: "heading", attrs: { level: 3 } }));
    expect(heading.content).toEqual([{ type: "heading", attrs: { level: 3 } }]);
  });

  test("rejects nesting beyond the depth limit and accepts it at the limit", () => {
    const nest = (levels: number): unknown => {
      let node: unknown = paragraph(text("x"));
      for (let index = 0; index < levels; index += 1) {
        node = { type: "blockquote", content: [node] };
      }
      return node;
    };
    expect(issueOf(doc(nest(richTextMaxDepth)))).toBe("too-deep");
    expect(issueOf(doc(nest(2)))).toBe("ok");
  });

  test("rejects more nodes than the limit", () => {
    const many = Array.from({ length: richTextMaxNodes + 1 }, () => paragraph());
    expect(issueOf(doc(...many))).toBe("too-large");
  });

  test("rejects more text than the limit", () => {
    const big = "a".repeat(richTextMaxTextLength);
    expect(issueOf(doc(paragraph(text(big), text("b"))))).toBe("too-large");
    expect(issueOf(doc(paragraph(text(big))))).toBe("ok");
  });
});

describe("isSafeRichTextHref", () => {
  test.each([
    "",
    "https://a.com/ b",
    `https://a.com/${"a".repeat(2048)}`,
    "ftp://a.com",
    "not a url",
    "https://a.com/\u0085",
  ])("rejects %j", (href) => {
    expect(isSafeRichTextHref(href)).toBe(false);
  });
});

describe("richTextBodySchema", () => {
  test("accepts a valid body and reports the rejection issue otherwise", () => {
    expect(richTextBodySchema.safeParse(doc(paragraph(text("a")))).success).toBe(true);
    const bad = richTextBodySchema.safeParse(doc({ type: "script" }));
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe("unknown-node");
  });
});

describe("rich text structure helpers", () => {
  const rich = ok(
    doc(
      { type: "heading", attrs: { level: 2 }, content: [text("T")] },
      paragraph(
        text("a", [{ type: "link", attrs: { href: "https://a.com" } }]),
        text("b", [{ type: "link", attrs: { href: "https://a.com" } }]),
        text("c", [{ type: "bold" }]),
        { type: "hardBreak" },
      ),
      { type: "image", attrs: { assetId: asset, alt: "pic" } },
      { type: "bulletList", content: [{ type: "listItem", content: [paragraph(text("x"))] }] },
      { type: "paragraph" },
    ),
  );

  test("collapses adjacent identical link runs and records heading levels", () => {
    const structure = richTextStructure(rich);
    expect(structure).toContain("heading2");
    expect(structure).toContain('["image","' + asset + '"]');
    expect(structure).toContain('"https://a.com",null');
    expect(structure).not.toContain('"https://a.com","https://a.com"');
  });

  test("a text edit keeps the structure but a link change does not", () => {
    const edited = ok(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [text("Changed")] },
        paragraph(
          text("a", [{ type: "link", attrs: { href: "https://a.com" } }]),
          text("b", [{ type: "link", attrs: { href: "https://a.com" } }]),
          text("c", [{ type: "bold" }]),
          { type: "hardBreak" },
        ),
        { type: "image", attrs: { assetId: asset, alt: "pic" } },
        { type: "bulletList", content: [{ type: "listItem", content: [paragraph(text("x"))] }] },
        { type: "paragraph" },
      ),
    );
    expect(sameRichTextStructure(rich, edited)).toBe(true);
    const relinked = ok(
      doc(paragraph(text("a", [{ type: "link", attrs: { href: "https://b.com" } }]))),
    );
    expect(sameRichTextStructure(relinked, ok(doc(paragraph(text("a")))))).toBe(false);
  });

  test("lists image ids from nested content", () => {
    const nested = ok(
      doc({
        type: "blockquote",
        content: [{ type: "image", attrs: { assetId: asset, alt: "p" } }],
      }),
    );
    expect(richTextImageIds(nested)).toEqual([asset]);
    expect(richTextImageIds(ok(doc(paragraph(text("a")))))).toEqual([]);
  });

  test("text changes cover breaks, images, nested blocks and missing blocks", () => {
    const before = ok(
      doc(
        paragraph(text("one"), { type: "hardBreak" }, text("two")),
        { type: "image", attrs: { assetId: asset, alt: "p" } },
        { type: "blockquote", content: [paragraph(text("quoted"))] },
        { type: "paragraph" },
      ),
    );
    const after = ok(
      doc(paragraph(text("one"), text("two")), {
        type: "blockquote",
        content: [paragraph(text("quoted"))],
      }),
    );
    expect(richTextTextChanges(before, after)).toEqual([
      { block: 1, before: "one\ntwo", after: "onetwo" },
    ]);
    const grown = ok(doc(paragraph(text("a")), paragraph(text("b"))));
    expect(richTextTextChanges(ok(doc(paragraph(text("a")))), grown)).toEqual([
      { block: 2, before: "", after: "b" },
    ]);
  });

  test("plain text of list items inside blocks is compared", () => {
    const withList = (value: string) =>
      ok(
        doc({
          type: "bulletList",
          content: [{ type: "listItem", content: [paragraph(text(value))] }],
        }),
      );
    expect(richTextTextChanges(withList("x"), withList("y"))).toEqual([
      { block: 1, before: "x", after: "y" },
    ]);
  });
});
