import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "vitest";

const root = join(import.meta.dirname, "..");
const source = join(root, "src");

function cssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith(".css") ? [relative(root, path)] : [];
  });
}

test("the app has exactly one CSS entry", () => {
  expect(cssFiles(source)).toEqual(["src/app/globals.css"]);
});

test("the CSS entry imports the shared theme and scans the shared components", () => {
  const css = readFileSync(join(source, "app/globals.css"), "utf8");
  expect(css).toContain('@import "@heat/ui/styles.css";');
  expect(css).toMatch(/@source "(\.\.\/)+packages\/ui\/src";/);
});

test("the root layout loads the CSS entry and mounts the theme provider", () => {
  const layout = readFileSync(join(source, "app/layout.tsx"), "utf8");
  expect(layout).toContain('import "./globals.css";');
  expect(layout).toContain("<ThemeProvider>");
  expect(layout).toContain("suppressHydrationWarning");
});

test("PostCSS runs the Tailwind plugin", () => {
  const config = readFileSync(join(root, "postcss.config.mjs"), "utf8");
  expect(config).toContain("@tailwindcss/postcss");
});
