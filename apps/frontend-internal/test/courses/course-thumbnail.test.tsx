import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CourseThumbnail } from "../../src/courses/course-thumbnail";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let container: HTMLElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
});

const show = (thumbnail: { url: string; alt: string } | null) => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<CourseThumbnail title="Consent" thumbnail={thumbnail} />));
};

describe("CourseThumbnail", () => {
  test("shows the uploaded image with its alt text", () => {
    show({ url: "/media/public/a/w640.webp", alt: "Cover" });
    const image = container?.querySelector("img");
    expect(image?.getAttribute("src")).toBe("/media/public/a/w640.webp");
    expect(image?.getAttribute("alt")).toBe("Cover");
  });

  test("falls back to a placeholder that names the course for screen readers", () => {
    show(null);
    expect(container?.querySelector("img")).toBeNull();
    expect(container?.textContent).toContain("No thumbnail for Consent");
  });
});
