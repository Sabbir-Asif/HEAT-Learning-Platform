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
  test("headings use Source Serif 4 and body text uses Public Sans, with the declared fallbacks", () => {
    expect(theme.get("--font-display")).toBe(
      '"Source Serif 4 Variable", Georgia, "Times New Roman", serif',
    );
    expect(theme.get("--font-sans")).toBe(
      '"Public Sans Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    );
  });

  test("the stylesheet imports both self-hosted font packages", () => {
    expect(css).toContain("@fontsource-variable/source-serif-4/wght.css");
    expect(css).toContain("@fontsource-variable/public-sans/wght.css");
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

  test("declares @font-face for both families with font-display swap", () => {
    const faces = builtCss.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    expect(faces.some((face) => face.includes("Source Serif 4 Variable"))).toBe(true);
    expect(faces.some((face) => face.includes("Public Sans Variable"))).toBe(true);
    for (const face of faces) expect(face).toContain("font-display:swap");
  });

  test("serves the woff2 files from its own output and requests nothing from a CDN", () => {
    expect(fontFiles.length).toBeGreaterThan(0);
    expect(builtCss).not.toMatch(/url\(["']?https?:/);
    expect(builtCss).not.toContain("fonts.googleapis");
  });

  test("the Latin files are among the emitted fonts", () => {
    expect(fontFiles.some((file) => file.includes("source-serif-4-latin-wght"))).toBe(true);
    expect(fontFiles.some((file) => file.includes("public-sans-latin-wght"))).toBe(true);
  });
});
