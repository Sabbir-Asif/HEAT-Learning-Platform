import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { describeShadow, tokens } from "../../src/tokens/token-data";
import { TokensPage } from "../../src/tokens/tokens-page";

describe.each(["light", "dark"] as const)("Tokens page, %s", (theme) => {
  const html = renderToStaticMarkup(<TokensPage theme={theme} />);

  test("shows every colour role with its name and value as text", () => {
    for (const [role, value] of Object.entries(tokens.colors[theme])) {
      expect(html, role).toContain(`>${role}</span>`);
      expect(html, role).toContain(`>${value}</span>`);
    }
  });

  test("shows every type style, radius, spacing step and shadow by name", () => {
    for (const name of Object.keys(tokens.type.styles)) expect(html, name).toContain(`${name}, `);
    for (const name of Object.keys(tokens.radius)) expect(html, name).toContain(`>${name}</span>`);
    for (const step of Object.keys(tokens.spacing.scale)) {
      expect(html, step).toContain(`>${step}</span>`);
    }
    for (const [name, layers] of Object.entries(tokens.shadows[theme])) {
      expect(html, name).toContain(describeShadow(layers));
    }
  });

  test("shows the specimen at each weight used", () => {
    for (const label of ["Source Serif 4, 600", "Source Serif 4, 700", "Public Sans, 400"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Public Sans, 600");
    expect(html).toContain("Public Sans, 700");
  });
});
