import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { compile } from "tailwindcss";
import { beforeAll, describe, expect, test } from "vitest";
import { blockDeclarations, readStyles } from "./support/css";

const require = createRequire(import.meta.url);
const css = readStyles();

async function build(candidates: string[]): Promise<string> {
  const compiler = await compile(css, {
    base: dirname(require.resolve("tailwindcss/package.json")),
    loadStylesheet: async (id, base) => {
      const path = id === "tailwindcss" ? require.resolve("tailwindcss/index.css") : id;
      return { path, base: dirname(path), content: readFileSync(path, "utf8") || base };
    },
  });
  return compiler.build(candidates);
}

describe("utilities resolve to the design tokens", () => {
  let output = "";

  beforeAll(async () => {
    output = await build([
      "bg-primary",
      "text-muted-foreground",
      "bg-status-success",
      "border-divider",
      "rounded-lg",
      "shadow-md",
      "text-heading-1",
      "dark:bg-card",
      "bg-red-500",
      "text-blue-600",
    ]);
  });

  test.each([
    [".bg-primary", "var(--primary)"],
    [".text-muted-foreground", "var(--muted-foreground)"],
    [".bg-status-success", "var(--status-success)"],
    [".border-divider", "var(--divider)"],
    [".rounded-lg", "var(--radius-lg)"],
    [".shadow-md", "var(--elevation-md)"],
    [".text-heading-1", "var(--text-heading-1)"],
  ])("%s uses %s", (selector, value) => {
    const rule = output.slice(output.indexOf(selector));
    expect(rule.slice(0, 400)).toContain(value);
  });

  test("the dark variant follows the dark class", () => {
    expect(output).toContain(":where(.dark, .dark *)");
    expect(output).toContain(".dark\\:bg-card");
  });

  test("no default Tailwind palette colour exists", () => {
    expect(output).not.toContain(".bg-red-500");
    expect(output).not.toContain(".text-blue-600");
  });
});

describe("theme mapping", () => {
  test("every per-theme variable is mapped into the Tailwind theme", () => {
    const mapped = blockDeclarations(css, "@theme inline");
    const mappedTargets = new Set([...mapped.values()]);
    for (const name of blockDeclarations(css, ":root").keys()) {
      expect(mappedTargets.has(`var(${name})`), name).toBe(true);
    }
  });
});
