import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Placeholder } from "../../src/placeholder/placeholder";

test("renders the heading, the text and a button named by its label", () => {
  const html = renderToStaticMarkup(
    <Placeholder heading="Setup check" text="Storybook is running." actionLabel="Continue" />,
  );
  expect(html).toContain("<h2>Setup check</h2>");
  expect(html).toContain("<p>Storybook is running.</p>");
  expect(html).toContain('<button type="button">Continue</button>');
});
