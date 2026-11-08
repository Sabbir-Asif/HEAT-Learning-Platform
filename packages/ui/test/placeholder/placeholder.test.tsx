import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Placeholder } from "../../src/placeholder/placeholder";
import { readStyles } from "../support/css";

function render() {
  return renderToStaticMarkup(
    <Placeholder heading="Setup check" text="Storybook is running." actionLabel="Continue" />,
  );
}

test("renders the heading, the text and a button named by its label", () => {
  const html = render();
  expect(html).toMatch(/<h2[^>]*>Setup check<\/h2>/);
  expect(html).toContain("Storybook is running.</p>");
  expect(html).toMatch(/<button[^>]*type="button"[^>]*>Continue<\/button>/);
});

test("is styled with token utilities, not with rules in the stylesheet", () => {
  const html = render();
  expect(html).toContain("bg-background");
  expect(html).toContain("text-foreground");
  expect(html).toContain("bg-primary");
  expect(html).toContain("text-primary-foreground");
  expect(readStyles()).not.toContain("heat-placeholder");
});
