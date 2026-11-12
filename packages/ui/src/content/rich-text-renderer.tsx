import { Fragment } from "react";
import { cn } from "../lib/utils";
import { isSafeHref } from "./rich-text-types";
import type {
  RichTextDocument,
  RichTextImage,
  RichTextMark,
  RichTextNode,
} from "./rich-text-types";

type RichTextRendererProps = Omit<React.ComponentProps<"div">, "children"> & {
  document: RichTextDocument;
  images?: readonly RichTextImage[];
};

const headingTags = { 2: "h3", 3: "h4", 4: "h5" } as const;

function applyMarks(text: string, marks: readonly RichTextMark[] | undefined): React.ReactNode {
  let node: React.ReactNode = text;
  for (const mark of marks ?? []) {
    if (mark.type === "bold") node = <strong>{node}</strong>;
    else if (mark.type === "italic") node = <em>{node}</em>;
    else if (isSafeHref(mark.attrs.href)) {
      node = (
        <a
          href={mark.attrs.href}
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4"
        >
          {node}
        </a>
      );
    }
  }
  return node;
}

function Children({
  nodes,
  images,
}: {
  nodes: readonly RichTextNode[] | undefined;
  images: ReadonlyMap<string, RichTextImage>;
}) {
  return (nodes ?? []).map((node, index) => (
    <Fragment key={index}>
      <Node node={node} images={images} />
    </Fragment>
  ));
}

function Node({
  node,
  images,
}: {
  node: RichTextNode;
  images: ReadonlyMap<string, RichTextImage>;
}) {
  switch (node.type) {
    case "text":
      return applyMarks(node.text, node.marks);
    case "hardBreak":
      return <br />;
    case "paragraph":
      return (
        <p>
          <Children nodes={node.content} images={images} />
        </p>
      );
    case "heading": {
      const Tag = headingTags[node.attrs.level];
      return (
        <Tag className="font-heading text-lg font-semibold">
          <Children nodes={node.content} images={images} />
        </Tag>
      );
    }
    case "bulletList":
      return (
        <ul className="flex list-disc flex-col gap-1 ps-6">
          <Children nodes={node.content} images={images} />
        </ul>
      );
    case "orderedList":
      return (
        <ol className="flex list-decimal flex-col gap-1 ps-6">
          <Children nodes={node.content} images={images} />
        </ol>
      );
    case "listItem":
      return (
        <li className="flex flex-col gap-1">
          <Children nodes={node.content} images={images} />
        </li>
      );
    case "blockquote":
      return (
        <blockquote className="border-border text-muted-foreground flex flex-col gap-2 border-s-4 ps-4">
          <Children nodes={node.content} images={images} />
        </blockquote>
      );
    case "image": {
      const image = images.get(node.attrs.assetId);
      if (image === undefined) return null;
      return (
        <img
          src={image.url}
          alt={node.attrs.alt}
          loading="lazy"
          className="h-auto max-w-full rounded-lg"
        />
      );
    }
    default:
      return null;
  }
}

function RichTextRenderer({ document, images = [], className, ...props }: RichTextRendererProps) {
  const byId = new Map(images.map((image) => [image.assetId, image]));
  return (
    <div
      data-slot="rich-text"
      className={cn("flex flex-col gap-4 text-base leading-relaxed break-words", className)}
      {...props}
    >
      <Children nodes={document.content} images={byId} />
    </div>
  );
}

export { RichTextRenderer };
export type { RichTextRendererProps };
