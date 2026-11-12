import { Fragment } from "react";
import { cn } from "../lib/utils";

type LessonInline = {
  kind: "text";
  text: string;
  bold: boolean;
  italic: boolean;
  href: string | null;
};

type LessonBlock =
  | { kind: "paragraph"; children: LessonInline[] }
  | { kind: "heading"; level: 2 | 3 | 4; children: LessonInline[] }
  | { kind: "list"; ordered: boolean; items: LessonInline[][] };

type LessonTextProps = Omit<React.ComponentProps<"div">, "children"> & {
  blocks: readonly LessonBlock[];
  title?: string;
};

const headingTags = { 2: "h3", 3: "h4", 4: "h5" } as const;

function Inlines({ inlines }: { inlines: readonly LessonInline[] }) {
  return inlines.map((inline, index) => {
    let node: React.ReactNode = inline.text;
    if (inline.bold) node = <strong>{node}</strong>;
    if (inline.italic) node = <em>{node}</em>;
    if (inline.href !== null) {
      node = (
        <a
          href={inline.href}
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4"
        >
          {node}
        </a>
      );
    }
    return <Fragment key={index}>{node}</Fragment>;
  });
}

function Block({ block }: { block: LessonBlock }) {
  if (block.kind === "paragraph") {
    return (
      <p>
        <Inlines inlines={block.children} />
      </p>
    );
  }
  if (block.kind === "heading") {
    const Tag = headingTags[block.level];
    return (
      <Tag className="font-heading text-lg font-semibold">
        <Inlines inlines={block.children} />
      </Tag>
    );
  }
  const List = block.ordered ? "ol" : "ul";
  return (
    <List className={cn("flex flex-col gap-1 ps-6", block.ordered ? "list-decimal" : "list-disc")}>
      {block.items.map((item, index) => (
        <li key={index}>
          <Inlines inlines={item} />
        </li>
      ))}
    </List>
  );
}

function LessonText({ blocks, title, className, ...props }: LessonTextProps) {
  return (
    <div
      data-slot="lesson-text"
      className={cn("flex flex-col gap-4 text-base leading-relaxed break-words", className)}
      {...props}
    >
      {title === undefined || title === "" ? null : (
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
      )}
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

export { LessonText };
export type { LessonBlock, LessonInline, LessonTextProps };
