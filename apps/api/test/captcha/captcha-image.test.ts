import { describe, expect, test } from "vitest";
import { alphabet } from "../../src/captcha/captcha-text";
import { glyphs } from "../../src/captcha/captcha-glyphs";
import { renderCaptchaSvg } from "../../src/captcha/captcha-image";
import { StubEntropy } from "../support/fakes";

describe("captcha image", () => {
  test("has a glyph for every character in the alphabet", () => {
    for (const character of alphabet) expect(glyphs[character]?.length).toBeGreaterThan(0);
  });

  test("draws the characters as paths with no text nodes", () => {
    const text = "AC2K7W";

    const svg = renderCaptchaSvg(text, new StubEntropy());

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain("<tspan");
    expect(svg).not.toContain("<title");
    expect(svg).not.toContain("<desc");
    expect(svg).toContain("<path");
    const textContent = svg.replace(/<[^>]*>/g, "");
    expect(textContent.trim()).toBe("");
    expect(svg).not.toContain(text);
  });

  test("contains no script or external reference", () => {
    const svg = renderCaptchaSvg("AC2K7W", new StubEntropy());

    expect(svg).not.toMatch(/<script|href=|xlink|onload|<image|<foreignObject/i);
  });

  test("two renders of the same text differ", () => {
    const a = renderCaptchaSvg("AC2K7W", { int: () => 1, unit: () => 0.2 });
    const b = renderCaptchaSvg("AC2K7W", { int: () => 2, unit: () => 0.8 });

    expect(a).not.toBe(b);
  });
});
