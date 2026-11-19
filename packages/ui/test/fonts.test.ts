import tailwindcss from "@tailwindcss/vite";
import { build } from "vite";
import type { Rollup } from "vite";
import { beforeAll, describe, expect, test } from "vitest";
import { blockDeclarations, readStyles, stylesPath } from "./support/css";

const css = readStyles();
const theme = blockDeclarations(css, "@theme");

function isAsset(item: Rollup.OutputChunk | Rollup.OutputAsset): item is Rollup.OutputAsset {
  return item.type === "asset";
}

describe("font tokens", () => {
  test("headings and body text both use DM Sans, with the declared fallbacks", () => {
    const stack = '"DM Sans Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    expect(theme.get("--font-display")).toBe(stack);
    expect(theme.get("--font-sans")).toBe(stack);
  });

  test("the stylesheet imports the self-hosted font package", () => {
    expect(css).toContain("@fontsource-variable/dm-sans/wght.css");
  });
});

describe("built stylesheet", () => {
  let builtCss = "";
  let fontFiles: string[] = [];

  beforeAll(async () => {
    const result = await build({
      logLevel: "silent",
      configFile: false,
      plugins: [tailwindcss()],
      build: { write: false, rollupOptions: { input: stylesPath } },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((entry) =>
      "output" in entry ? entry.output : [],
    );
    const assets = outputs.filter(isAsset);
    builtCss = assets
      .filter((asset) => asset.fileName.endsWith(".css"))
      .map((asset) => String(asset.source))
      .join("\n");
    fontFiles = assets.filter((asset) => asset.fileName.endsWith(".woff2")).map((a) => a.fileName);
  }, 60_000);

  test("declares @font-face for the family with font-display swap", () => {
    const faces = builtCss.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    expect(faces.some((face) => face.includes("DM Sans Variable"))).toBe(true);
    for (const face of faces) expect(face).toContain("font-display:swap");
  });

  test("serves the woff2 files from its own output and requests nothing from a CDN", () => {
    expect(fontFiles.length).toBeGreaterThan(0);
    expect(builtCss).not.toMatch(/url\(["']?https?:/);
    expect(builtCss).not.toContain("fonts.googleapis");
  });

  test("the Latin files are among the emitted fonts", () => {
    expect(fontFiles.some((file) => file.includes("dm-sans-latin-wght"))).toBe(true);
  });
});
