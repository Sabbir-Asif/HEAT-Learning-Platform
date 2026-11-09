import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const srcRoot = join(import.meta.dirname, "../src");
const scanned = ["components", "composites", "lib", "hooks", "data", "shell"];

const allowedPackages = [
  "react",
  "react-dom",
  "@base-ui/react",
  "lucide-react",
  "sonner",
  "class-variance-authority",
  "clsx",
  "tailwind-merge",
  "next-themes",
  "react-hook-form",
  "@storybook/react-vite",
  "storybook/test",
];

const folderPackages: Record<string, string[]> = {
  data: ["@tanstack/react-table", "nuqs"],
};

const forbiddenPackagePrefixes = ["@radix-ui/", "@headlessui/", "@mui/", "@chakra-ui/", "antd"];

const palette =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";

const colourLiteral = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl|hwb|lab|lch|oklab|oklch)a?\(/;
const defaultPalette = new RegExp(
  `\\b(?:bg|text|border|ring|fill|stroke|outline|divide|from|to|via|shadow|accent|caret|decoration)-(?:${palette})\\b`,
);
const arbitraryValue =
  /(?<![\w-])(?!(?:data|aria|has|in|group|peer|supports|nth)-)[a-z][\w-]*-\[([^\]]*)\]/g;
const literalInsideBrackets =
  /\d(?:px|rem|em|vh|vw|svh|dvh|ch|deg|%)|#[0-9a-fA-F]{3,8}|rgb|hsl|oklch/i;
const offScaleRadius = /\brounded(?:-[a-z]+)*-(?:xs|2xl|3xl|4xl)\b/;
const comment = /(?:^|[^:"'`\w])\/\/|\/\*/;

function listSources(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listSources(path);
    return /\.(tsx?|css)$/.test(entry.name) ? [path] : [];
  });
}

function scannedFiles(): string[] {
  return scanned.flatMap((folder) => {
    try {
      return listSources(join(srcRoot, folder));
    } catch {
      return [];
    }
  });
}

function violations(source: string): string[] {
  const found: string[] = [];
  if (colourLiteral.test(source)) found.push("colour literal");
  if (defaultPalette.test(source)) found.push("default palette colour");
  for (const match of source.matchAll(arbitraryValue)) {
    if (literalInsideBrackets.test(match[1] ?? "")) found.push(`arbitrary value ${match[0]}`);
  }
  if (offScaleRadius.test(source)) found.push("radius outside the scale");
  if (source.split("\n").some((line) => comment.test(line))) found.push("comment");
  return found;
}

function importedPackages(source: string): string[] {
  const specifiers = [...source.matchAll(/(?:from|import)\s+["']([^"'.][^"']*)["']/g)];
  return specifiers.map((match) => match[1] ?? "");
}

function isAllowed(specifier: string, folder = ""): boolean {
  if (forbiddenPackagePrefixes.some((prefix) => specifier.startsWith(prefix))) return false;
  return [...allowedPackages, ...(folderPackages[folder] ?? [])].some(
    (allowed) => specifier === allowed || specifier.startsWith(`${allowed}/`),
  );
}

describe("the rule checks themselves", () => {
  test("flag a hex colour, a default palette colour and an arbitrary size", () => {
    expect(violations('<div className="bg-[#fff]" />')).toContain("colour literal");
    expect(violations('<div className="text-red-500" />')).toContain("default palette colour");
    expect(violations('<div className="w-[320px]" />')).toContain("arbitrary value w-[320px]");
  });

  test("flag comments but not URLs in strings", () => {
    expect(violations("const a = 1; // note")).toContain("comment");
    expect(violations("/* note */")).toContain("comment");
    expect(violations('const url = "https://example.com";')).toEqual([]);
  });

  test("allow token utilities, variable references and Base UI state selectors", () => {
    const source =
      '<div className="bg-primary text-primary-foreground min-w-(--anchor-width) data-[open]:bg-accent in-data-[side=left]:rounded-md w-[var(--anchor-width)]" />';
    expect(violations(source)).toEqual([]);
  });

  test("reject UI libraries outside the allowed set", () => {
    expect(isAllowed("@base-ui/react/dialog")).toBe(true);
    expect(isAllowed("lucide-react")).toBe(true);
    expect(isAllowed("@radix-ui/react-dialog")).toBe(false);
    expect(isAllowed("react-icons")).toBe(false);
  });

  test("allow the table and URL libraries only inside the data folder", () => {
    expect(isAllowed("@tanstack/react-table", "data")).toBe(true);
    expect(isAllowed("nuqs/adapters/testing", "data")).toBe(true);
    expect(isAllowed("@tanstack/react-table", "components")).toBe(false);
    expect(isAllowed("nuqs", "composites")).toBe(false);
    expect(isAllowed("nuqs")).toBe(false);
  });
});

describe("every primitive source", () => {
  const files = scannedFiles();

  test.each(files.map((file) => [file.slice(srcRoot.length + 1), file]))(
    "%s uses tokens only and has no comments",
    (_name, file) => {
      expect(violations(readFileSync(file as string, "utf8"))).toEqual([]);
    },
  );

  test.each(files.map((file) => [file.slice(srcRoot.length + 1), file]))(
    "%s imports only allowed libraries",
    (_name, file) => {
      const unexpected = importedPackages(readFileSync(file as string, "utf8")).filter(
        (specifier) =>
          !isAllowed(specifier, (file as string).slice(srcRoot.length + 1).split("/")[0]),
      );
      expect(unexpected).toEqual([]);
    },
  );
});

test("the radius check flags off-scale radii only", () => {
  expect(violations('<span className="rounded-4xl" />')).toContain("radius outside the scale");
  expect(violations('<span className="rounded-full rounded-md rounded-t-lg" />')).toEqual([]);
});
