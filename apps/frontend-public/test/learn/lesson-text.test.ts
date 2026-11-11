import { describe, expect, test } from "vitest";
import { safeHref, sanitizeLessonBody } from "../../src/learn/lesson-text";

const text = (value: string, marks: object[] = []) => ({ type: "text", text: value, marks });
const paragraph = (...content: object[]) => ({ type: "paragraph", content });
const doc = (...content: object[]) => ({ type: "doc", content });
const plain = (value: string) => ({
  kind: "text",
  text: value,
  bold: false,
  italic: false,
  href: null,
});

describe("sanitizeLessonBody", () => {
  test("renders paragraphs of plain text", () => {
    expect(sanitizeLessonBody(doc(paragraph(text("Hello")), paragraph(text("World"))))).toEqual([
      { kind: "paragraph", children: [plain("Hello")] },
      { kind: "paragraph", children: [plain("World")] },
    ]);
  });

  test("keeps bold and italic marks and ignores unknown marks", () => {
    const [block] = sanitizeLessonBody(
      doc(paragraph(text("a", [{ type: "bold" }, { type: "italic" }, { type: "highlight" }]))),
    );

    expect(block).toEqual({
      kind: "paragraph",
      children: [{ kind: "text", text: "a", bold: true, italic: true, href: null }],
    });
  });

  test.each(["https://example.org/a", "mailto:help@du.ac.bd"])("keeps a %s link", (href) => {
    const [block] = sanitizeLessonBody(
      doc(paragraph(text("go", [{ type: "link", attrs: { href } }]))),
    );

    expect(block).toMatchObject({ children: [{ text: "go", href: new URL(href).href }] });
  });

  test.each([
    "javascript:alert(1)",
    "  JavaScript:alert(1)",
    "java\nscript:alert(1)",
    "http://example.org",
    "data:text/html,x",
    "/relative",
    "//example.org",
    "",
  ])("drops the link but keeps the text for the href %j", (href) => {
    const [block] = sanitizeLessonBody(
      doc(paragraph(text("go", [{ type: "link", attrs: { href } }]))),
    );

    expect(block).toEqual({ kind: "paragraph", children: [plain("go")] });
  });

  test("drops a link without an href", () => {
    const [block] = sanitizeLessonBody(doc(paragraph(text("go", [{ type: "link" }]))));

    expect(block).toEqual({ kind: "paragraph", children: [plain("go")] });
  });

  test("does not render unknown block nodes or anything inside them", () => {
    const result = sanitizeLessonBody(
      doc(
        { type: "script", content: [paragraph(text("evil"))] },
        { type: "image", attrs: { src: "https://example.org/x.png" } },
        paragraph(text("kept")),
      ),
    );

    expect(result).toEqual([{ kind: "paragraph", children: [plain("kept")] }]);
  });

  test("does not render unknown inline nodes", () => {
    const [block] = sanitizeLessonBody(
      doc(paragraph(text("a"), { type: "iframe", text: "x" }, text("b"))),
    );

    expect(block).toEqual({ kind: "paragraph", children: [plain("a"), plain("b")] });
  });

  test("keeps headings from level 2 to 4 and clamps the rest into that range", () => {
    const result = sanitizeLessonBody(
      doc(
        { type: "heading", attrs: { level: 1 }, content: [text("one")] },
        { type: "heading", attrs: { level: 3 }, content: [text("three")] },
        { type: "heading", attrs: { level: 6 }, content: [text("six")] },
        { type: "heading", content: [text("none")] },
      ),
    );

    expect(result.map((block) => (block.kind === "heading" ? block.level : null))).toEqual([
      2, 3, 4, 2,
    ]);
  });

  test("renders bullet and ordered lists with their item text", () => {
    const item = (value: string) => ({ type: "listItem", content: [paragraph(text(value))] });

    expect(
      sanitizeLessonBody(
        doc(
          { type: "bulletList", content: [item("a"), item("b")] },
          { type: "orderedList", content: [item("c")] },
        ),
      ),
    ).toEqual([
      { kind: "list", ordered: false, items: [[plain("a")], [plain("b")]] },
      { kind: "list", ordered: true, items: [[plain("c")]] },
    ]);
  });

  test("drops unknown children of a list and empty lists", () => {
    expect(
      sanitizeLessonBody(doc({ type: "bulletList", content: [{ type: "div", content: [] }] })),
    ).toEqual([]);
  });

  test.each([null, undefined, "text", 3, [], {}, { type: "paragraph" }, { type: "doc" }])(
    "returns nothing for a malformed body %j",
    (body) => {
      expect(sanitizeLessonBody(body)).toEqual([]);
    },
  );

  test("drops paragraphs and headings that hold no text", () => {
    expect(
      sanitizeLessonBody(doc(paragraph(), { type: "heading", content: [{ type: "text" }] })),
    ).toEqual([]);
  });

  test("ignores text nodes whose text is not a string", () => {
    expect(sanitizeLessonBody(doc(paragraph({ type: "text", text: 4 }, text("ok"))))).toEqual([
      { kind: "paragraph", children: [plain("ok")] },
    ]);
  });

  test("does not recurse into deeply nested lists", () => {
    let nested: object = paragraph(text("deep"));
    for (let level = 0; level < 40; level += 1)
      nested = { type: "bulletList", content: [{ type: "listItem", content: [nested] }] };

    expect(() => sanitizeLessonBody(doc(nested))).not.toThrow();
  });
});

describe("safeHref", () => {
  test("accepts https and mailto only", () => {
    expect(safeHref("https://example.org")).toBe("https://example.org/");
    expect(safeHref("mailto:a@b.test")).toBe("mailto:a@b.test");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref(5)).toBeNull();
  });
});
