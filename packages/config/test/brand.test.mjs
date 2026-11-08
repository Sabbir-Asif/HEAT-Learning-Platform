import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  MAX_SVG_BYTES,
  PIXEL_DIFFERENCE_LIMIT,
  optimise,
  pixelDifference,
  sanitise,
} from "../src/brand.mjs";

const fixture = (name) => readFileSync(resolve(import.meta.dirname, "fixtures/svg", name), "utf8");

const svg = (body, attributes = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"${attributes}>${body}</svg>`;

const byteOrderMark = String.fromCharCode(0xfeff);

const problems = (text) => sanitise(text).join("\n");

describe("sanitise", () => {
  test("accepts a clean SVG", () => {
    expect(sanitise(fixture("clean.svg"))).toEqual([]);
  });

  test("accepts gradients, clip paths and fragment references", () => {
    const text = svg(
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/></linearGradient><clipPath id="c"><rect width="5" height="5"/></clipPath></defs><use href="#c"/><use xlink:href="#c" xmlns:xlink="http://www.w3.org/1999/xlink"/><path d="M0 0h5v5z" fill="url(#g)" clip-path="url(#c)"/>',
    );
    expect(sanitise(text)).toEqual([]);
  });

  test("accepts an XML declaration and a leading byte order mark", () => {
    expect(
      sanitise(`${byteOrderMark}<?xml version="1.0" encoding="UTF-8"?>\n${svg("<g/>")}`),
    ).toEqual([]);
  });

  test("the raster-wrapped site file fails and the message names <image> and data:", () => {
    const report = problems(fixture("raster-wrapped.svg"));
    expect(report).toContain("<image>");
    expect(report).toContain("data:");
  });

  test.each([
    ["script", "<script>alert(1)</script>", "<script>"],
    ["foreignObject", "<foreignObject><div/></foreignObject>", "<foreignObject>"],
    ["style", "<style>rect{fill:red}</style>", "<style>"],
    ["image", '<image href="#a"/>', "<image>"],
    ["anchor", '<a href="#a"><rect/></a>', "<a>"],
    ["animate", '<rect><animate attributeName="x" to="1"/></rect>', "<animate>"],
    ["set", '<rect><set attributeName="x" to="1"/></rect>', "<set>"],
    ["iframe", "<iframe/>", "<iframe>"],
    ["embed", "<embed/>", "<embed>"],
    ["text", "<text>HEAT</text>", "<text>"],
  ])("rejects the %s element and names it", (_name, body, named) => {
    expect(problems(svg(body))).toContain(named);
  });

  test("tells the author to convert text to outlines", () => {
    expect(problems(svg("<text>HEAT</text>"))).toContain("outlines");
  });

  test.each([
    ["onload", '<rect onload="x()"/>', "onload"],
    ["onclick", '<rect onclick="x()"/>', "onclick"],
    ["ONMOUSEOVER", '<rect ONMOUSEOVER="x()"/>', "ONMOUSEOVER"],
  ])("rejects the %s event handler and names it", (_name, body, named) => {
    expect(problems(svg(body))).toContain(named);
  });

  test("rejects a style attribute", () => {
    expect(problems(svg('<rect style="fill:red"/>'))).toContain("style attribute");
  });

  test.each([
    ["data:", '<rect fill="data:image/png;base64,AAAA"/>', "data:"],
    ["javascript:", '<use href="javascript:alert(1)"/>', "javascript:"],
    ["http:", '<rect fill="http://example.com/x"/>', "http:"],
    ["https:", '<rect stroke="https://example.com/x"/>', "https:"],
    ["protocol-relative", '<use href="//example.com/x.svg#a"/>', "//"],
    ["external url()", '<rect fill="url(https://example.com/x.svg#a)"/>', "url("],
    ["relative url()", '<rect fill="url(x.svg#a)"/>', "url("],
    ["external href", '<use href="other.svg#a"/>', "href"],
    [
      "external xlink:href",
      '<use xlink:href="x.svg#a" xmlns:xlink="http://www.w3.org/1999/xlink"/>',
      "xlink:href",
    ],
  ])("rejects a %s value and names it", (_name, body, named) => {
    expect(problems(svg(body))).toContain(named);
  });

  test("rejects a changed xmlns", () => {
    expect(problems('<svg xmlns="http://evil.example/ns" viewBox="0 0 1 1"/>')).toContain("xmlns");
  });

  test.each([
    [
      "DOCTYPE",
      '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
      "<!DOCTYPE",
    ],
    [
      "ENTITY",
      '<!DOCTYPE svg [<!ENTITY a "b">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
      "<!DOCTYPE",
    ],
    [
      "processing instruction",
      '<?xml-stylesheet href="a.css"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
      "processing instruction",
    ],
  ])("rejects %s and names it", (_name, text, named) => {
    expect(problems(text)).toContain(named);
  });

  test("rejects an attribute that is not on the allow-list and names it", () => {
    expect(problems(svg('<rect data-x="1" filter="url(#f)"/>'))).toContain("data-x");
  });

  test("rejects an element that is not on the allow-list and names it", () => {
    expect(problems(svg("<pattern/>"))).toContain("<pattern>");
  });

  test("requires a viewBox", () => {
    expect(problems('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>')).toContain("viewBox");
  });

  test("requires an svg root", () => {
    expect(problems('<g xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>')).toContain(
      "<svg>",
    );
  });

  test.each([
    ["unclosed tag", "<svg viewBox='0 0 1 1'><g></svg>"],
    ["unquoted attribute", "<svg viewBox=0><g/></svg>"],
    ["bare ampersand", svg("<g id='a&b'/>")],
    ["empty input", ""],
    ["text content", svg("hello")],
  ])("rejects malformed or textual input: %s", (_name, text) => {
    expect(sanitise(text).length).toBeGreaterThan(0);
  });

  test("rejects a file over the size cap and says so", () => {
    const padded = svg(`<path d="${"M0 0".repeat(MAX_SVG_BYTES)}"/>`);
    expect(problems(padded)).toContain("20 KB");
  });

  test("reports each problem once", () => {
    const report = sanitise(svg("<script/><script/>"));
    expect(report.filter((line) => line.includes("<script>"))).toHaveLength(1);
  });
});

describe("optimise", () => {
  const verbose = fixture("verbose.svg");

  test("makes the file strictly smaller", () => {
    expect(Buffer.byteLength(optimise(verbose))).toBeLessThan(Buffer.byteLength(verbose));
  });

  test("changes at most 0.2% of pixels at 512 px", () => {
    expect(pixelDifference(verbose, optimise(verbose))).toBeLessThanOrEqual(PIXEL_DIFFERENCE_LIMIT);
  });

  test("gives the same bytes when run on its own output", () => {
    const once = optimise(verbose);
    expect(optimise(once)).toBe(once);
  });

  test("keeps the viewBox, width and height and drops metadata", () => {
    const out = optimise(verbose);
    expect(out).toContain('viewBox="0 0 120 80"');
    expect(out).toContain('width="120"');
    expect(out).toContain('height="80"');
    expect(out).not.toMatch(/<title|<desc|<\?xml|<!--/);
  });

  test("keeps gradient references working", () => {
    const out = optimise(verbose);
    expect(out).toMatch(/fill="url\(#\w+\)"/);
    expect(sanitise(out)).toEqual([]);
  });

  test("normalises a byte order mark and Windows line endings", () => {
    const noisy = `${byteOrderMark}${verbose.replaceAll("\n", "\r\n")}`;
    expect(optimise(noisy)).toBe(optimise(verbose));
  });

  test("throws on input that is not XML", () => {
    expect(() => optimise("<svg")).toThrow();
  });
});

describe("pixelDifference", () => {
  const square = (fill) => svg(`<rect width="10" height="10" fill="${fill}"/>`);

  test("is zero for the same picture", () => {
    expect(pixelDifference(square("#ff0000"), square("#ff0000"))).toBe(0);
  });

  test("is one when every pixel changes", () => {
    expect(pixelDifference(square("#ff0000"), square("#0000ff"))).toBe(1);
  });

  test("ignores colour steps of 8 or less", () => {
    expect(pixelDifference(square("#ff0000"), square("#f80000"))).toBe(0);
    expect(pixelDifference(square("#ff0000"), square("#f60000"))).toBe(1);
  });

  test("counts a different shape", () => {
    const half = svg('<rect width="5" height="10" fill="#ff0000"/>');
    expect(pixelDifference(square("#ff0000"), half)).toBeCloseTo(0.5, 1);
  });
});
