import { courseSlugMaxLength } from "@heat/contracts";
import type { NewsPostRequest, NewsStatus, RichTextDoc, RichTextNode } from "@heat/contracts";

const slugStemLength = 60;

const fallbackStem = "post";

const summaryMaxLength = 200;

export const slugStem = (title: string): string => {
  const stem = title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, slugStemLength)
    .replace(/-+$/g, "");
  return stem === "" ? fallbackStem : stem;
};

export const pickSlug = (title: string, taken: ReadonlySet<string>): string => {
  const stem = slugStem(title);
  if (!taken.has(stem)) return stem;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${stem}-${suffix}`.slice(0, courseSlugMaxLength);
    if (!taken.has(candidate)) return candidate;
  }
};

export const newsState = (publishedAt: Date | null, now: Date): NewsStatus => {
  if (publishedAt === null) return "draft";
  return publishedAt.getTime() > now.getTime() ? "scheduled" : "published";
};

export const planPublishedAt = (
  request: Pick<NewsPostRequest, "status" | "publishedAt">,
  now: Date,
  current: Date | null = null,
): Date | null => {
  if (request.status === "draft") return null;
  if (request.publishedAt !== null) return new Date(request.publishedAt);
  return current ?? now;
};

const collectText = (nodes: readonly RichTextNode[], parts: string[]): void => {
  for (const node of nodes) {
    if (node.type === "text") parts.push(node.text);
    else if (node.type === "hardBreak") parts.push(" ");
    else if (node.type !== "image" && node.content !== undefined) {
      collectText(node.content, parts);
      parts.push(" ");
    }
  }
};

export const summaryOf = (doc: RichTextDoc): string => {
  const parts: string[] = [];
  collectText(doc.content, parts);
  const text = parts.join("").replace(/\s+/g, " ").trim();
  if (text.length <= summaryMaxLength) return text;
  return `${text.slice(0, summaryMaxLength - 1).trimEnd()}…`;
};

export const coverAssetIdOf = (doc: RichTextDoc): string | null => {
  const find = (nodes: readonly RichTextNode[]): string | null => {
    for (const node of nodes) {
      if (node.type === "image") return node.attrs.assetId;
      if ("content" in node && node.content !== undefined) {
        const found = find(node.content);
        if (found !== null) return found;
      }
    }
    return null;
  };
  return find(doc.content);
};
