import { Node } from "@tiptap/react";

type ImageResolver = (assetId: string) => string | null;

function createImageNode(resolve: ImageResolver) {
  return Node.create({
    name: "image",
    group: "block",
    atom: true,
    draggable: true,
    addAttributes() {
      return {
        assetId: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-asset-id"),
        },
        alt: { default: "", parseHTML: (element) => element.getAttribute("alt") ?? "" },
      };
    },
    parseHTML() {
      return [{ tag: "img[data-asset-id]" }];
    },
    renderHTML({ node }) {
      const assetId = String(node.attrs.assetId ?? "");
      return [
        "img",
        {
          "data-asset-id": assetId,
          src: resolve(assetId) ?? "",
          alt: String(node.attrs.alt ?? ""),
          class: "h-auto max-w-full rounded-lg",
        },
      ];
    },
  });
}

export { createImageNode };
export type { ImageResolver };
