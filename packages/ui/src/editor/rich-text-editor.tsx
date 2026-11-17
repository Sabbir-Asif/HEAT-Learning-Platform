"use client";

import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { cn } from "../lib/utils";
import { isSafeHref } from "../content/rich-text-types";
import type { RichTextDocument, RichTextImage } from "../content/rich-text-types";
import { createImageNode } from "./image-node";
import { normalizeEditorDocument } from "./normalize";

type RichTextEditorProps = {
  value: RichTextDocument;
  onChange: (document: RichTextDocument) => void;
  images?: readonly RichTextImage[];
  onUploadImage?: (file: File, alt: string) => Promise<RichTextImage>;
  label: string;
  disabled?: boolean;
  className?: string;
};

type Panel = "none" | "link" | "image";

const contentClasses =
  "min-h-48 rounded-b-lg px-3 py-2 text-base leading-relaxed outline-none focus-visible:ring-ring/50 focus-visible:ring-3 [&_p]:my-2 [&_h3]:font-heading [&_h3]:my-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:font-heading [&_h4]:my-3 [&_h4]:text-lg [&_h4]:font-semibold [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:list-decimal [&_ol]:ps-6 [&_blockquote]:border-border [&_blockquote]:border-s-4 [&_blockquote]:ps-4 [&_a]:text-primary [&_a]:underline";

function RichTextEditor({
  value,
  onChange,
  images = [],
  onUploadImage,
  label,
  disabled = false,
  className,
}: RichTextEditorProps) {
  const [known] = useState(() => new Map<string, string>());
  useEffect(() => {
    for (const image of images) known.set(image.assetId, image.url);
  }, [images, known]);
  const [panel, setPanel] = useState<Panel>("none");
  const [href, setHref] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: false,
          protocols: ["mailto"],
          isAllowedUri: (url) => isSafeHref(url),
        },
      }),
      createImageNode((assetId) => known.get(assetId) ?? null),
    ],
    [known],
  );

  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        class: contentClasses,
      },
    },
    onUpdate: ({ editor: current }) => onChange(normalizeEditorDocument(current.getJSON())),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (editor === null) return null;

  const closePanel = () => {
    setPanel("none");
    setMessage(null);
    setHref("");
    setFile(null);
    setAlt("");
  };

  const applyLink = () => {
    const trimmed = href.trim();
    if (trimmed === "") {
      editor.chain().focus().unsetLink().run();
      closePanel();
      return;
    }
    if (!isSafeHref(trimmed)) {
      setMessage("Use a link that starts with https: or mailto:.");
      return;
    }
    editor.chain().focus().setLink({ href: trimmed }).run();
    closePanel();
  };

  const insertImage = async () => {
    if (file === null || onUploadImage === undefined) return;
    if (alt.trim() === "") {
      setMessage("Describe the image so people using a screen reader can follow the lesson.");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await onUploadImage(file, alt.trim());
      known.set(uploaded.assetId, uploaded.url);
      editor
        .chain()
        .focus()
        .insertContent({ type: "image", attrs: { assetId: uploaded.assetId, alt: alt.trim() } })
        .run();
      closePanel();
    } catch {
      setMessage("The image could not be uploaded. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const tool = (
    name: string,
    icon: React.ReactNode,
    active: boolean,
    run: () => void,
    unavailable = false,
  ) => (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      aria-label={name}
      aria-pressed={active}
      disabled={disabled || unavailable}
      onClick={run}
    >
      {icon}
    </Button>
  );

  return (
    <div
      data-slot="rich-text-editor"
      className={cn("border-input flex flex-col rounded-lg border", className)}
    >
      <div
        role="toolbar"
        aria-label={`${label} formatting`}
        className="border-border flex flex-wrap gap-1 border-b p-1"
      >
        {tool("Bold", <Bold />, editor.isActive("bold"), () =>
          editor.chain().focus().toggleBold().run(),
        )}
        {tool("Italic", <Italic />, editor.isActive("italic"), () =>
          editor.chain().focus().toggleItalic().run(),
        )}
        {tool("Heading 2", <Heading2 />, editor.isActive("heading", { level: 2 }), () =>
          editor.chain().focus().toggleHeading({ level: 2 }).run(),
        )}
        {tool("Heading 3", <Heading3 />, editor.isActive("heading", { level: 3 }), () =>
          editor.chain().focus().toggleHeading({ level: 3 }).run(),
        )}
        {tool("Bulleted list", <List />, editor.isActive("bulletList"), () =>
          editor.chain().focus().toggleBulletList().run(),
        )}
        {tool("Numbered list", <ListOrdered />, editor.isActive("orderedList"), () =>
          editor.chain().focus().toggleOrderedList().run(),
        )}
        {tool("Quote", <Quote />, editor.isActive("blockquote"), () =>
          editor.chain().focus().toggleBlockquote().run(),
        )}
        {tool("Link", <Link2 />, editor.isActive("link"), () => {
          setHref(String(editor.getAttributes("link").href ?? ""));
          setPanel(panel === "link" ? "none" : "link");
        })}
        {tool(
          "Insert image",
          <ImagePlus />,
          panel === "image",
          () => setPanel(panel === "image" ? "none" : "image"),
          onUploadImage === undefined,
        )}
        {tool(
          "Undo",
          <Undo2 />,
          false,
          () => editor.chain().focus().undo().run(),
          !editor.can().undo(),
        )}
        {tool(
          "Redo",
          <Redo2 />,
          false,
          () => editor.chain().focus().redo().run(),
          !editor.can().redo(),
        )}
      </div>
      {panel === "link" ? (
        <div className="border-border flex flex-col gap-2 border-b p-2">
          <Label htmlFor="rich-text-link">Link address</Label>
          <div className="flex gap-2">
            <Input
              id="rich-text-link"
              value={href}
              onChange={(event) => setHref(event.target.value)}
              placeholder="https:"
              aria-invalid={message !== null}
            />
            <Button type="button" onClick={applyLink}>
              Apply
            </Button>
            <Button type="button" variant="outline" onClick={closePanel}>
              Cancel
            </Button>
          </div>
          {message === null ? null : (
            <p role="alert" className="text-destructive text-sm">
              {message}
            </p>
          )}
        </div>
      ) : null}
      {panel === "image" ? (
        <div className="border-border flex flex-col gap-2 border-b p-2">
          <Label htmlFor="rich-text-image-file">Image file</Label>
          <Input
            id="rich-text-image-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Label htmlFor="rich-text-image-alt">Image description (required)</Label>
          <Input
            id="rich-text-image-alt"
            value={alt}
            maxLength={300}
            onChange={(event) => setAlt(event.target.value)}
            aria-invalid={message !== null}
          />
          {message === null ? null : (
            <p role="alert" className="text-destructive text-sm">
              {message}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={file === null || uploading}
              onClick={() => void insertImage()}
            >
              Insert image
            </Button>
            <Button type="button" variant="outline" onClick={closePanel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}

export { RichTextEditor };
export type { RichTextEditorProps };
