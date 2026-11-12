import jsQR from "jsqr";
import { describe, expect, test } from "vitest";
import { buildVerifyUrl, renderQrSvg } from "../../src/certificate/certificate-qr";

const scale = 8;

const rasterise = (svg: string) => {
  const total = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1]);
  const path = /<path d="([^"]*)"/.exec(svg)?.[1] ?? "";
  const side = total * scale;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  for (const match of path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    const column = Number(match[1]);
    const row = Number(match[2]);
    for (let y = row * scale; y < (row + 1) * scale; y += 1) {
      for (let x = column * scale; x < (column + 1) * scale; x += 1) {
        const offset = (y * side + x) * 4;
        pixels[offset] = 0;
        pixels[offset + 1] = 0;
        pixels[offset + 2] = 0;
      }
    }
  }
  return { pixels, side };
};

describe("buildVerifyUrl", () => {
  test("builds the absolute verification URL from the base origin", () => {
    expect(buildVerifyUrl("https://learn.example.org/", "ABCD-0123-WXYZ")).toBe(
      "https://learn.example.org/verify/ABCD-0123-WXYZ",
    );
  });

  test("rejects a malformed number", () => {
    expect(() => buildVerifyUrl("https://learn.example.org", "../admin")).toThrow();
  });
});

describe("renderQrSvg", () => {
  test("decodes back to exactly the verification URL", () => {
    const url = buildVerifyUrl("https://learn.example.org", "ABCD-0123-WXYZ");
    const { pixels, side } = rasterise(renderQrSvg(url, "#000000", "#ffffff"));
    const decoded = jsQR(pixels, side, side);
    expect(decoded?.data).toBe("https://learn.example.org/verify/ABCD-0123-WXYZ");
  });

  test("contains no remote reference", () => {
    const svg = renderQrSvg("https://learn.example.org/verify/ABCD-0123-WXYZ", "#000", "#fff");
    expect(svg).not.toMatch(/https?:|xlink|href/);
  });
});
