import { parseRichText } from "@heat/contracts";
import type { LessonContentSection } from "@heat/contracts";
import type { LessonBlock, LessonInline } from "@heat/ui";
import type { RichTextDocument, RichTextImage } from "@heat/ui/content";

const allowedProtocols: readonly string[] = ["https:", "mailto:"];

type Node = Record<string, unknown>;

const asNode = (value: unknown): Node | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

const childrenOf = (node: Node): unknown[] => (Array.isArray(node.content) ? node.content : []);

export const safeHref = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return allowedProtocols.includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const marksOf = (node: Node): Node[] =>
  Array.isArray(node.marks)
    ? node.marks.flatMap((mark: unknown): Node[] => {
        const entry = asNode(mark);
        return entry === null ? [] : [entry];
      })
    : [];

const inlineOf = (value: unknown): LessonInline | null => {
  const node = asNode(value);
  if (node === null || node.type !== "text" || typeof node.text !== "string") return null;
  const marks = marksOf(node);
  const link = marks.find((mark) => mark.type === "link");
  return {
    kind: "text",
    text: node.text,
    bold: marks.some((mark) => mark.type === "bold"),
    italic: marks.some((mark) => mark.type === "italic"),
    href: link === undefined ? null : safeHref(asNode(link.attrs)?.href),
  };
};

const inlinesOf = (node: Node): LessonInline[] =>
  childrenOf(node).flatMap((child) => inlineOf(child) ?? []);

const itemOf = (value: unknown): LessonInline[] | null => {
  const node = asNode(value);
  if (node === null || node.type !== "listItem") return null;
  const inlines = childrenOf(node).flatMap((child) => {
    const paragraph = asNode(child);
    return paragraph !== null && paragraph.type === "paragraph" ? inlinesOf(paragraph) : [];
  });
  return inlines.length === 0 ? null : inlines;
};

const headingLevel = (node: Node): 2 | 3 | 4 => {
  const level = asNode(node.attrs)?.level;
  if (typeof level !== "number" || level <= 2) return 2;
  return level >= 4 ? 4 : 3;
};

const blockOf = (value: unknown): LessonBlock | null => {
  const node = asNode(value);
  if (node === null) return null;
  if (node.type === "paragraph") {
    const children = inlinesOf(node);
    return children.length === 0 ? null : { kind: "paragraph", children };
  }
  if (node.type === "heading") {
    const children = inlinesOf(node);
    return children.length === 0 ? null : { kind: "heading", level: headingLevel(node), children };
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    const items = childrenOf(node)
      .map(itemOf)
      .filter((item): item is LessonInline[] => item !== null);
    return items.length === 0
      ? null
      : { kind: "list", ordered: node.type === "orderedList", items };
  }
  return null;
};

export const sanitizeLessonBody = (body: unknown): LessonBlock[] => {
  const root = asNode(body);
  if (root === null || root.type !== "doc") return [];
  return childrenOf(root).flatMap((child) => blockOf(child) ?? []);
};

export interface RichSection {
  document: RichTextDocument;
  images: RichTextImage[];
}

export const richSectionOf = (section: LessonContentSection): RichSection | null => {
  const parsed = parseRichText(section.body);
  return parsed.ok ? { document: parsed.doc, images: section.images } : null;
};
