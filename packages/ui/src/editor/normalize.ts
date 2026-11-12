import { isSafeHref } from "../content/rich-text-types";
import type { RichTextDocument, RichTextMark, RichTextNode } from "../content/rich-text-types";

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const childrenOf = (value: unknown): Json[] => (Array.isArray(value) ? value.filter(isRecord) : []);

function markOf(value: Json): RichTextMark | null {
  if (value.type === "bold") return { type: "bold" };
  if (value.type === "italic") return { type: "italic" };
  if (value.type === "link" && isRecord(value.attrs)) {
    const href = value.attrs.href;
    if (typeof href === "string" && isSafeHref(href)) return { type: "link", attrs: { href } };
  }
  return null;
}

function inlineOf(value: Json): RichTextNode | null {
  if (value.type === "hardBreak") return { type: "hardBreak" };
  if (value.type !== "text" || typeof value.text !== "string" || value.text === "") return null;
  const marks = childrenOf(value.marks)
    .map(markOf)
    .filter((mark): mark is RichTextMark => mark !== null);
  return marks.length === 0
    ? { type: "text", text: value.text }
    : { type: "text", text: value.text, marks };
}

const inlinesOf = (value: unknown): RichTextNode[] =>
  childrenOf(value)
    .map(inlineOf)
    .filter((node): node is RichTextNode => node !== null);

const blocksOf = (value: unknown): RichTextNode[] =>
  childrenOf(value)
    .map(blockOf)
    .filter((node): node is RichTextNode => node !== null);

function withInlines<T extends { type: string }>(base: T, value: unknown): T {
  const content = inlinesOf(value);
  return content.length === 0 ? base : { ...base, content };
}

const headingLevel = (value: unknown): 2 | 3 | 4 | null =>
  value === 2 ? 2 : value === 3 ? 3 : value === 4 ? 4 : null;

function blockOf(value: Json): RichTextNode | null {
  switch (value.type) {
    case "paragraph":
      return withInlines({ type: "paragraph" as const }, value.content);
    case "heading": {
      const level = headingLevel(isRecord(value.attrs) ? value.attrs.level : undefined);
      if (level === null) return null;
      return withInlines({ type: "heading" as const, attrs: { level } }, value.content);
    }
    case "bulletList":
    case "orderedList": {
      const content = childrenOf(value.content)
        .map(blockOf)
        .filter((node): node is RichTextNode => node !== null);
      return content.length === 0 ? null : { type: value.type, content };
    }
    case "listItem":
    case "blockquote": {
      const content = blocksOf(value.content);
      return content.length === 0 ? null : { type: value.type, content };
    }
    case "image": {
      if (!isRecord(value.attrs)) return null;
      const { assetId, alt } = value.attrs;
      if (typeof assetId !== "string" || typeof alt !== "string" || alt.trim() === "") return null;
      return { type: "image", attrs: { assetId, alt } };
    }
    default:
      return null;
  }
}

function normalizeEditorDocument(value: unknown): RichTextDocument {
  const content = isRecord(value) ? blocksOf(value.content) : [];
  return { type: "doc", content };
}

export { normalizeEditorDocument };
