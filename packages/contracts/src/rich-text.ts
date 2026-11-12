import { z } from "zod";

export const richTextSchemaVersion = 1;

export const richTextHeadingLevels = [2, 3, 4] as const;

export const richTextImageAltMaxLength = 300;

export const richTextLinkProtocols = ["https:", "mailto:"] as const;

export const richTextMaxDepth = 8;

export const richTextMaxNodes = 5000;

export const richTextMaxTextLength = 200_000;

export type RichTextMark =
  { type: "bold" } | { type: "italic" } | { type: "link"; attrs: { href: string } };

export type RichTextNode =
  | { type: "text"; text: string; marks?: RichTextMark[] }
  | { type: "hardBreak" }
  | { type: "paragraph"; content?: RichTextNode[] }
  | { type: "heading"; attrs: { level: 2 | 3 | 4 }; content?: RichTextNode[] }
  | { type: "bulletList"; content: RichTextNode[] }
  | { type: "orderedList"; content: RichTextNode[] }
  | { type: "listItem"; content: RichTextNode[] }
  | { type: "blockquote"; content: RichTextNode[] }
  | { type: "image"; attrs: { assetId: string; alt: string } };

export interface RichTextDoc {
  type: "doc";
  content: RichTextNode[];
}

export type RichTextIssue =
  | "not-an-object"
  | "unknown-node"
  | "unknown-mark"
  | "unknown-key"
  | "bad-attrs"
  | "bad-content"
  | "bad-link"
  | "missing-alt"
  | "too-deep"
  | "too-large";

export type RichTextParse = { ok: true; doc: RichTextDoc } | { ok: false; issue: RichTextIssue };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const blockTypes = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "image",
]);

const inlineTypes = new Set(["text", "hardBreak"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isSafeRichTextHref = (href: string): boolean => {
  if (href.length === 0 || href.length > 2048 || /[\u0000- \u007f-\u009f]/.test(href)) {
    return false;
  }
  try {
    const url = new URL(href);
    return (richTextLinkProtocols as readonly string[]).includes(url.protocol);
  } catch {
    return false;
  }
};

class Rejection extends Error {
  constructor(readonly issue: RichTextIssue) {
    super(issue);
  }
}

const reject = (issue: RichTextIssue): never => {
  throw new Rejection(issue);
};

const onlyKeys = (value: Record<string, unknown>, allowed: string[]): void => {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) reject("unknown-key");
  }
};

const readMark = (value: unknown): RichTextMark => {
  if (!isRecord(value)) return reject("unknown-mark");
  if (value.type === "bold" || value.type === "italic") {
    onlyKeys(value, ["type"]);
    return { type: value.type };
  }
  if (value.type === "link") {
    onlyKeys(value, ["type", "attrs"]);
    const attrs = value.attrs;
    if (!isRecord(attrs)) return reject("bad-link");
    onlyKeys(attrs, ["href"]);
    const href = attrs.href;
    if (typeof href !== "string" || !isSafeRichTextHref(href)) return reject("bad-link");
    return { type: "link", attrs: { href } };
  }
  return reject("unknown-mark");
};

interface Budget {
  nodes: number;
  text: number;
}

const readChildren = (
  value: unknown,
  allowed: (type: string) => boolean,
  depth: number,
  budget: Budget,
  required: boolean,
): RichTextNode[] | undefined => {
  if (value === undefined) {
    if (required) reject("bad-content");
    return undefined;
  }
  if (!Array.isArray(value)) return reject("bad-content");
  if (required && value.length === 0) reject("bad-content");
  return value.map((child) => {
    if (!isRecord(child) || typeof child.type !== "string") return reject("unknown-node");
    if (!allowed(child.type)) return reject("bad-content");
    return readNode(child, depth, budget);
  });
};

const withContent = <T extends { type: string }>(
  base: T,
  content: RichTextNode[] | undefined,
): T & { content?: RichTextNode[] } => (content === undefined ? base : { ...base, content });

const readNode = (value: Record<string, unknown>, depth: number, budget: Budget): RichTextNode => {
  if (depth > richTextMaxDepth) reject("too-deep");
  budget.nodes += 1;
  if (budget.nodes > richTextMaxNodes) reject("too-large");
  const type = value.type;
  if (type === "text") {
    onlyKeys(value, ["type", "text", "marks"]);
    const text = value.text;
    if (typeof text !== "string" || text.length === 0) return reject("bad-content");
    budget.text += text.length;
    if (budget.text > richTextMaxTextLength) reject("too-large");
    if (value.marks === undefined) return { type: "text", text };
    if (!Array.isArray(value.marks)) return reject("unknown-mark");
    const marks = value.marks.map(readMark);
    return marks.length === 0 ? { type: "text", text } : { type: "text", text, marks };
  }
  if (type === "hardBreak") {
    onlyKeys(value, ["type"]);
    return { type: "hardBreak" };
  }
  if (type === "paragraph") {
    onlyKeys(value, ["type", "content"]);
    const content = readChildren(
      value.content,
      (t) => inlineTypes.has(t),
      depth + 1,
      budget,
      false,
    );
    return withContent({ type: "paragraph" as const }, content);
  }
  if (type === "heading") {
    onlyKeys(value, ["type", "attrs", "content"]);
    const attrs = value.attrs;
    if (!isRecord(attrs)) return reject("bad-attrs");
    onlyKeys(attrs, ["level"]);
    const level = attrs.level;
    if (level !== 2 && level !== 3 && level !== 4) return reject("bad-attrs");
    const content = readChildren(
      value.content,
      (t) => inlineTypes.has(t),
      depth + 1,
      budget,
      false,
    );
    return withContent({ type: "heading" as const, attrs: { level } }, content);
  }
  if (type === "bulletList" || type === "orderedList") {
    onlyKeys(value, ["type", "content"]);
    const content = readChildren(value.content, (t) => t === "listItem", depth + 1, budget, true);
    return { type, content: content ?? [] };
  }
  if (type === "listItem" || type === "blockquote") {
    onlyKeys(value, ["type", "content"]);
    const content = readChildren(value.content, (t) => blockTypes.has(t), depth + 1, budget, true);
    return { type, content: content ?? [] };
  }
  if (type === "image") {
    onlyKeys(value, ["type", "attrs"]);
    const attrs = value.attrs;
    if (!isRecord(attrs)) return reject("bad-attrs");
    onlyKeys(attrs, ["assetId", "alt"]);
    const { assetId, alt } = attrs;
    if (typeof assetId !== "string" || !uuidPattern.test(assetId)) return reject("bad-attrs");
    if (typeof alt !== "string" || alt.trim().length === 0) return reject("missing-alt");
    if (alt.length > richTextImageAltMaxLength) return reject("bad-attrs");
    return { type: "image", attrs: { assetId, alt } };
  }
  return reject("unknown-node");
};

export const parseRichText = (value: unknown): RichTextParse => {
  if (!isRecord(value)) return { ok: false, issue: "not-an-object" };
  try {
    onlyKeys(value, ["type", "content"]);
    if (value.type !== "doc") return { ok: false, issue: "unknown-node" };
    const content = readChildren(
      value.content ?? [],
      (t) => blockTypes.has(t),
      1,
      { nodes: 0, text: 0 },
      false,
    );
    return { ok: true, doc: { type: "doc", content: content ?? [] } };
  } catch (error) {
    if (error instanceof Rejection) return { ok: false, issue: error.issue };
    throw error;
  }
};

export const richTextBodySchema = z
  .record(z.string(), z.unknown())
  .superRefine((value, context) => {
    const parsed = parseRichText(value);
    if (!parsed.ok) context.addIssue({ code: "custom", message: parsed.issue });
  });

export const richTextEmptyDoc: RichTextDoc = { type: "doc", content: [] };

export const lessonBodyRequestSchema = z.object({
  schemaVersion: z.literal(richTextSchemaVersion),
  body: richTextBodySchema,
});

export type LessonBodyRequest = z.infer<typeof lessonBodyRequestSchema>;

export const lessonBodyImageSchema = z.object({
  assetId: z.uuid(),
  url: z.string(),
  alt: z.string(),
});

export type LessonBodyImage = z.infer<typeof lessonBodyImageSchema>;

export const lessonBodyResponseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  schemaVersion: z.number().int().min(1),
  body: z.record(z.string(), z.unknown()),
  images: z.array(lessonBodyImageSchema),
});

export type LessonBodyResponse = z.infer<typeof lessonBodyResponseSchema>;

export const richTextImageIds = (doc: RichTextDoc): string[] => {
  const ids: string[] = [];
  const visit = (nodes: RichTextNode[]): void => {
    for (const node of nodes) {
      if (node.type === "image") ids.push(node.attrs.assetId);
      if ("content" in node && node.content !== undefined) visit(node.content);
    }
  };
  visit(doc.content);
  return ids;
};

const structureOf = (nodes: RichTextNode[]): unknown[] =>
  nodes.map((node) => {
    if (node.type === "text") {
      const link = node.marks?.find((mark) => mark.type === "link");
      return link === undefined ? null : link.attrs.href;
    }
    if (node.type === "image") return ["image", node.attrs.assetId];
    if (node.type === "hardBreak") return ["hardBreak"];
    const children = "content" in node && node.content !== undefined ? node.content : [];
    const head = node.type === "heading" ? `heading${node.attrs.level}` : node.type;
    return [head, collapseRuns(structureOf(children))];
  });

const collapseRuns = (items: unknown[]): unknown[] => {
  const result: unknown[] = [];
  for (const item of items) {
    const isRun = item === null || typeof item === "string";
    const last = result[result.length - 1];
    if (
      isRun &&
      result.length > 0 &&
      (last === null || typeof last === "string") &&
      last === item
    ) {
      continue;
    }
    result.push(item);
  }
  return result;
};

export const richTextStructure = (doc: RichTextDoc): string =>
  JSON.stringify(collapseRuns(structureOf(doc.content)));

export const sameRichTextStructure = (before: RichTextDoc, after: RichTextDoc): boolean =>
  richTextStructure(before) === richTextStructure(after);

export interface RichTextTextChange {
  block: number;
  before: string;
  after: string;
}

const plainText = (nodes: RichTextNode[] | undefined): string =>
  (nodes ?? [])
    .map((node) => {
      if (node.type === "text") return node.text;
      if (node.type === "hardBreak") return "\n";
      if (node.type === "image") return "";
      return "content" in node ? plainText(node.content) : "";
    })
    .join("");

const textBlocks = (nodes: RichTextNode[]): string[] => {
  const blocks: string[] = [];
  for (const node of nodes) {
    if (node.type === "paragraph" || node.type === "heading") {
      blocks.push(plainText(node.content));
    } else if ("content" in node && node.content !== undefined) {
      blocks.push(...textBlocks(node.content));
    }
  }
  return blocks;
};

export const richTextTextChanges = (
  before: RichTextDoc,
  after: RichTextDoc,
): RichTextTextChange[] => {
  const left = textBlocks(before.content);
  const right = textBlocks(after.content);
  const changes: RichTextTextChange[] = [];
  const length = Math.max(left.length, right.length);
  for (let block = 0; block < length; block += 1) {
    const was = left[block] ?? "";
    const now = right[block] ?? "";
    if (was !== now) changes.push({ block: block + 1, before: was, after: now });
  }
  return changes;
};
