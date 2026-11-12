type RichTextMark =
  { type: "bold" } | { type: "italic" } | { type: "link"; attrs: { href: string } };

type RichTextNode =
  | { type: "text"; text: string; marks?: RichTextMark[] }
  | { type: "hardBreak" }
  | { type: "paragraph"; content?: RichTextNode[] }
  | { type: "heading"; attrs: { level: 2 | 3 | 4 }; content?: RichTextNode[] }
  | { type: "bulletList"; content: RichTextNode[] }
  | { type: "orderedList"; content: RichTextNode[] }
  | { type: "listItem"; content: RichTextNode[] }
  | { type: "blockquote"; content: RichTextNode[] }
  | { type: "image"; attrs: { assetId: string; alt: string } };

type RichTextDocument = { type: "doc"; content: RichTextNode[] };

type RichTextImage = { assetId: string; url: string; alt: string };

const allowedProtocols = ["https:", "mailto:"];

function isSafeHref(href: string): boolean {
  try {
    return allowedProtocols.includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

export { isSafeHref };
export type { RichTextDocument, RichTextImage, RichTextMark, RichTextNode };
