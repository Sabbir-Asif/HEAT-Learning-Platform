import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { LessonText } from "../src/composites/lesson-text";
import type { LessonBlock } from "../src/composites/lesson-text";

afterEach(cleanup);

const text = (value: string, extra: object = {}) => ({
  kind: "text" as const,
  text: value,
  bold: false,
  italic: false,
  href: null,
  ...extra,
});

describe("LessonText", () => {
  test("renders paragraphs, headings one level below the page headings, and lists", () => {
    const blocks: LessonBlock[] = [
      { kind: "heading", level: 2, children: [text("Why")] },
      { kind: "paragraph", children: [text("Body")] },
      { kind: "list", ordered: false, items: [[text("one")], [text("two")]] },
      { kind: "list", ordered: true, items: [[text("first")]] },
    ];

    const { container } = render(<LessonText blocks={blocks} />);

    expect(screen.getByRole("heading", { level: 3, name: "Why" })).toBeTruthy();
    expect(screen.getByText("Body").tagName).toBe("P");
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelectorAll("ol > li")).toHaveLength(1);
  });

  test("renders bold, italic and links with a safe rel", () => {
    const blocks: LessonBlock[] = [
      {
        kind: "paragraph",
        children: [
          text("b", { bold: true }),
          text("i", { italic: true }),
          text("l", { href: "https://example.org/" }),
        ],
      },
    ];

    const { container } = render(<LessonText blocks={blocks} />);

    expect(container.querySelector("strong")?.textContent).toBe("b");
    expect(container.querySelector("em")?.textContent).toBe("i");
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.org/");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("renders nothing for no blocks", () => {
    const { container } = render(<LessonText blocks={[]} />);

    expect(container.querySelector('[data-slot="lesson-text"]')?.childElementCount).toBe(0);
  });

  test("renders a title as a level 2 heading and skips an empty one", () => {
    const { rerender } = render(<LessonText title="Intro" blocks={[]} />);

    expect(screen.getByRole("heading", { level: 2, name: "Intro" })).toBeTruthy();

    rerender(<LessonText title="" blocks={[]} />);

    expect(screen.queryByRole("heading")).toBeNull();
  });
});
