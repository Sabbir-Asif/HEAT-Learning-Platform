import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  MAX_ELEMENT_DEPTH,
  MAX_SOURCE_BYTES,
  MAX_USE_ELEMENTS,
  MAX_SVG_BYTES,
  PIXEL_DIFFERENCE_LIMIT,
  buildBrand,
  checkBrand,
  contrastRatio,
  legibility,
  readThemeBackgrounds,
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

describe("buildBrand and checkBrand", () => {
  const work = [];
  afterEach(() => {
    for (const dir of work.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  const mark = fixture("verbose.svg").replace(/ *<(title|desc)>.*<\/\1>\n/g, "");

  const workspace = (sources = { "mark.svg": mark }) => {
    const base = mkdtempSync(join(tmpdir(), "brand-"));
    work.push(base);
    const sourceDir = join(base, "source");
    mkdirSync(sourceDir);
    for (const [name, text] of Object.entries(sources)) writeFileSync(join(sourceDir, name), text);
    return { sourceDir, targetDirs: [join(base, "a/brand"), join(base, "b/brand")] };
  };

  const list = (dir) => readdirSync(dir).sort();

  test("writes the optimised file byte for byte into every target", () => {
    const location = workspace();
    buildBrand(location);
    const expected = optimise(mark);
    for (const dir of location.targetDirs)
      expect(readFileSync(join(dir, "mark.svg"), "utf8")).toBe(expected);
  });

  test("a second run changes nothing and reports nothing written", () => {
    const location = workspace();
    buildBrand(location);
    const before = readFileSync(join(location.targetDirs[0], "mark.svg"), "utf8");
    expect(buildBrand(location).written).toEqual([]);
    expect(readFileSync(join(location.targetDirs[0], "mark.svg"), "utf8")).toBe(before);
  });

  test("removes files in a target that no source produces", () => {
    const location = workspace();
    buildBrand(location);
    writeFileSync(join(location.targetDirs[1], "stray.svg"), "<svg/>");
    buildBrand(location);
    expect(list(location.targetDirs[1])).toEqual(["mark.svg"]);
  });

  test("refuses a source that fails the sanitiser and names the file", () => {
    const location = workspace({ "bad.svg": svg("<script/>") });
    expect(() => buildBrand(location)).toThrow(/bad\.svg.*<script>/s);
    expect(() => readdirSync(location.targetDirs[0])).toThrow();
  });

  test("refuses a source over the source cap and names it", () => {
    const heavy = svg(`<path d="${"M0 0".repeat(MAX_SOURCE_BYTES)}"/>`);
    const location = workspace({ "heavy.svg": heavy });
    expect(() => buildBrand(location)).toThrow(/heavy\.svg.*128 KB/s);
  });

  test("accepts a source over 20 KB and refuses its output when still over 20 KB", () => {
    const coordinates = Array.from(
      { length: 6000 },
      (_, i) => `${(i * 7919) % 997} ${(i * 104729) % 991}`,
    );
    const heavy = svg(`<path d="M${coordinates.join("L")}"/>`);
    expect(Buffer.byteLength(heavy)).toBeGreaterThan(MAX_SVG_BYTES);
    expect(sanitise(heavy, { maxBytes: MAX_SOURCE_BYTES })).toEqual([]);
    const location = workspace({ "heavy.svg": heavy });
    expect(() => buildBrand(location)).toThrow(/heavy\.svg.*after SVGO.*20 KB/s);
  });

  test("accepts a source over 20 KB when its output fits under 20 KB", () => {
    const padded = svg(
      `<path d="${"M 0.000000 0.000000 L 1.000000 1.000000 ".repeat(1000)}" fill="#000"/>`,
    );
    expect(Buffer.byteLength(padded)).toBeGreaterThan(MAX_SVG_BYTES);
    const location = workspace({ "padded.svg": padded });
    buildBrand(location);
    expect(checkBrand(location)).toEqual([]);
  });

  test("refuses a symbolic link in a target and does not write through it", () => {
    const location = workspace();
    buildBrand(location);
    const outside = join(work[0], "outside.svg");
    writeFileSync(outside, "keep");
    rmSync(join(location.targetDirs[0], "mark.svg"));
    symlinkSync(outside, join(location.targetDirs[0], "mark.svg"));
    expect(() => buildBrand(location)).toThrow(/a\/brand\/mark\.svg.*symbolic link/s);
    expect(readFileSync(outside, "utf8")).toBe("keep");
  });

  test("refuses a symbolic link named like a stray file and leaves it in place", () => {
    const location = workspace();
    buildBrand(location);
    const outside = join(work[0], "outside.svg");
    writeFileSync(outside, "keep");
    symlinkSync(outside, join(location.targetDirs[1], "stray.svg"));
    expect(() => buildBrand(location)).toThrow(/stray\.svg.*symbolic link/s);
    expect(readFileSync(outside, "utf8")).toBe("keep");
    expect(list(location.targetDirs[1])).toContain("stray.svg");
  });

  test("refuses a symbolic link whose name is not .svg", () => {
    const location = workspace();
    buildBrand(location);
    symlinkSync(location.sourceDir, join(location.targetDirs[0], "link"));
    expect(() => buildBrand(location)).toThrow(/link.*symbolic link/s);
  });

  test("refuses a target directory that is a symbolic link", () => {
    const location = workspace();
    const real = join(work[0], "real");
    mkdirSync(real);
    mkdirSync(join(work[0], "a"));
    symlinkSync(real, location.targetDirs[0]);
    expect(() => buildBrand(location)).toThrow(/a\/brand.*symbolic link/s);
    expect(list(real)).toEqual([]);
  });

  test("refuses a public directory that is a symbolic link", () => {
    const location = workspace();
    const real = join(work[0], "real-public");
    mkdirSync(join(real, "brand"), { recursive: true });
    symlinkSync(real, join(work[0], "a"));
    expect(() => buildBrand(location)).toThrow(/symbolic link/);
    expect(list(join(real, "brand"))).toEqual([]);
  });

  test("refuses a directory named like an SVG", () => {
    const location = workspace();
    buildBrand(location);
    mkdirSync(join(location.targetDirs[0], "folder.svg"));
    expect(() => buildBrand(location)).toThrow(/folder\.svg.*not a regular file/s);
  });

  test("deletes only .svg files and leaves other strays for check to report", () => {
    const location = workspace();
    buildBrand(location);
    writeFileSync(join(location.targetDirs[0], "notes.html"), "<p>x</p>");
    writeFileSync(join(location.targetDirs[0], "stray.svg"), "<svg/>");
    buildBrand(location);
    expect(list(location.targetDirs[0])).toEqual(["mark.svg", "notes.html"]);
    expect(checkBrand(location).join("\n")).toMatch(/notes\.html.*stray/);
  });

  test("check reports a symbolic link instead of reading through it", () => {
    const location = workspace();
    buildBrand(location);
    const outside = join(work[0], "outside.svg");
    writeFileSync(outside, optimise(mark));
    rmSync(join(location.targetDirs[0], "mark.svg"));
    symlinkSync(outside, join(location.targetDirs[0], "mark.svg"));
    expect(checkBrand(location).join("\n")).toMatch(/a\/brand\/mark\.svg.*symbolic link/);
  });

  test("check passes right after a build", () => {
    const location = workspace();
    buildBrand(location);
    expect(checkBrand(location)).toEqual([]);
  });

  test("check names a missing file", () => {
    const location = workspace();
    buildBrand(location);
    rmSync(join(location.targetDirs[1], "mark.svg"));
    expect(checkBrand(location).join("\n")).toMatch(/b\/brand\/mark\.svg.*missing/);
  });

  test("check names a stray file", () => {
    const location = workspace();
    buildBrand(location);
    writeFileSync(join(location.targetDirs[0], "extra.svg"), "<svg/>");
    expect(checkBrand(location).join("\n")).toMatch(/a\/brand\/extra\.svg.*stray/);
  });

  test("check names a hand-edited file", () => {
    const location = workspace();
    buildBrand(location);
    writeFileSync(join(location.targetDirs[0], "mark.svg"), svg("<g/>"));
    expect(checkBrand(location).join("\n")).toMatch(/a\/brand\/mark\.svg.*differs/);
  });

  test("check names a target that fails the sanitiser", () => {
    const location = workspace();
    buildBrand(location);
    writeFileSync(join(location.targetDirs[0], "mark.svg"), svg("<script/>"));
    expect(checkBrand(location).join("\n")).toMatch(/a\/brand\/mark\.svg.*<script>/);
  });

  test("check fails when a target directory does not exist", () => {
    const location = workspace();
    expect(checkBrand(location).join("\n")).toMatch(/mark\.svg.*missing/);
  });

  test("ignores files in the source directory that are not SVG", () => {
    const location = workspace({ "mark.svg": mark, "notes.txt": "x" });
    buildBrand(location);
    expect(list(location.targetDirs[0])).toEqual(["mark.svg"]);
  });
});

describe("contrastRatio", () => {
  test("is 21 for black on white and 1 for identical colours", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#336699", "#336699")).toBe(1);
  });

  test("does not depend on the order of the colours", () => {
    expect(contrastRatio("#1d4ed8", "#0b1220")).toBeCloseTo(
      contrastRatio("#0b1220", "#1d4ed8"),
      10,
    );
  });
});

describe("readThemeBackgrounds", () => {
  test("reads --background from the :root and .dark blocks of the real stylesheet", () => {
    const css = readFileSync(resolve(import.meta.dirname, "../../ui/src/styles.css"), "utf8");
    expect(readThemeBackgrounds(css)).toEqual({ light: "#ffffff", dark: "#0b1220" });
  });

  test("reads the values of a different stylesheet", () => {
    const css =
      ":root { --background: #fafafa; --x: 1 }\n.dark { color: red; --background: #101010 }";
    expect(readThemeBackgrounds(css)).toEqual({ light: "#fafafa", dark: "#101010" });
  });

  test.each([
    ["no :root block", ".dark { --background: #000000 }"],
    ["no .dark block", ":root { --background: #ffffff }"],
    [
      "a background that is not a hex colour",
      ":root { --background: oklch(1 0 0) }\n.dark { --background: #000 }",
    ],
  ])("throws on %s and says what to update", (_name, css) => {
    expect(() => readThemeBackgrounds(css)).toThrow(/--background/);
  });
});

describe("legibility", () => {
  const light = "#ffffff";
  const dark = "#0b1220";
  const mark = (fill) => svg(`<rect x="1" y="1" width="8" height="8" fill="${fill}"/>`);
  const problemsFor = (text, background) => legibility(text, background).problems;

  test("a dark mark is legible on the light background and not on the dark one", () => {
    expect(problemsFor(mark("#0f172a"), light)).toEqual([]);
    expect(problemsFor(mark("#0f172a"), dark).join("\n")).toMatch(/contrast/);
  });

  test("a light mark is legible on the dark background and not on the light one", () => {
    expect(problemsFor(mark("#e5e7eb"), dark)).toEqual([]);
    expect(problemsFor(mark("#e5e7eb"), light).join("\n")).toMatch(/painted/);
  });

  test("tolerates a small low-contrast share and fails a large one", () => {
    const body = (width) =>
      `<rect width="10" height="10" fill="#0f172a"/><rect x="0" y="0" width="${width}" height="10" fill="#b8bcc4"/>`;
    expect(problemsFor(svg(body(1)), light)).toEqual([]);
    expect(problemsFor(svg(body(5)), light).join("\n")).toMatch(/contrast/);
  });

  test("an empty picture fails because nothing is painted", () => {
    expect(problemsFor(svg("<g/>"), light).join("\n")).toMatch(/painted/);
  });

  test("a hairline that paints less than 1% of the canvas fails", () => {
    const hairline = svg('<rect width="10" height="0.05" fill="#0f172a"/>');
    expect(problemsFor(hairline, light).join("\n")).toMatch(/painted/);
  });

  test("renders at 40 px high at 1x and 2x and reports both", () => {
    const result = legibility(mark("#0f172a"), light);
    expect(result.renders.map((r) => r.height)).toEqual([40, 80]);
  });

  test("white inside a dark mark is the mark's own paper and is ignored on a light background", () => {
    const disc = svg(
      '<circle cx="5" cy="5" r="5" fill="#0f172a"/><circle cx="5" cy="5" r="3.5" fill="#ffffff"/>',
    );
    expect(problemsFor(disc, light)).toEqual([]);
    expect(problemsFor(disc, dark).join("\n")).toMatch(/contrast/);
  });

  test("a white-only mark is invisible on a light background and legible on a dark one", () => {
    expect(problemsFor(mark("#ffffff"), light).join("\n")).toMatch(/painted/);
    expect(problemsFor(mark("#ffffff"), dark)).toEqual([]);
  });

  test("judges the colour of a thin line, not its anti-aliased blend with the background", () => {
    const thin = svg('<rect x="0" y="4.6" width="10" height="0.8" fill="#0f172a"/>');
    expect(problemsFor(thin, light)).toEqual([]);
  });

  test("does not count pixels below half opacity as painted", () => {
    const faint = svg('<rect width="10" height="10" fill="#0f172a" fill-opacity="0.4"/>');
    expect(problemsFor(faint, light).join("\n")).toMatch(/painted/);
  });

  test("names the background and the failing scale in each problem", () => {
    const [first] = problemsFor(mark("#0f172a"), dark);
    expect(first).toContain("#0b1220");
    expect(first).toMatch(/40 px|80 px/);
  });
});

describe("sanitise attribute grammar", () => {
  const withAttribute = (name, value) => svg(`<rect ${name}="${value}"/>`);
  const reasons = (text) => sanitise(text).join("\n");

  test.each([
    ["url written with a CSS escape", "u\\72l(\\68ttps:\\2f\\2fevil.example/x.svg#a)"],
    ["a relative url written with a CSS escape", "u\\72l(x.svg#a)"],
    ["an uppercase hex escape with a trailing space", "\\55 RL(x.svg#a)"],
    ["a escaped scheme", "\\68ttp://evil.example/x"],
    ["a single backslash", "red\\"],
  ])("rejects %s in fill and names the backslash", (_name, value) => {
    expect(reasons(withAttribute("fill", value))).toContain("backslash");
  });

  test.each(["mask", "clip-path", "stroke", "stop-color", "transform", "d"])(
    "rejects an escaped url( in %s",
    (name) => {
      expect(reasons(withAttribute(name, "\\75rl(#a)"))).toContain("backslash");
    },
  );

  test("rejects a backslash that arrives through a character reference", () => {
    expect(reasons(withAttribute("fill", "u&#92;72l(x.svg#a)"))).toContain("backslash");
  });

  test.each([
    ["fill", "url(#a)"],
    ["stroke", "url(#grad-1)"],
    ["mask", "url(#m.1)"],
    ["clip-path", "url(#c_2)"],
  ])("accepts %s=%s", (name, value) => {
    expect(sanitise(withAttribute(name, value))).toEqual([]);
  });

  test.each([
    ["fill", "url(#a) red"],
    ["fill", "url( #a)"],
    ["fill", "URL(#a)"],
    ["fill", "url(#a#b)"],
    ["fill", "url(#a)url(#b)"],
    ["mask", "url(#a) url(#b)"],
    ["clip-path", "url('#a')"],
    ["fill", "url(#)"],
  ])("rejects the url form %s=%s", (name, value) => {
    expect(sanitise(withAttribute(name, value)).length).toBeGreaterThan(0);
  });

  test.each([
    ["fill", "calc(1 + 2)"],
    ["opacity", "var(--x)"],
    ["width", "calc(100% - 4px)"],
    ["d", "M0 0 attr(x)"],
    ["stroke-width", "env(x)"],
    ["fill", "image(x.png)"],
    ["clip-path", "polygon(0 0, 1 1, 0 1)"],
    ["transform", "url(#a)"],
    ["offset", "translate(1 2)"],
  ])("rejects a parenthesis in %s=%s", (name, value) => {
    expect(reasons(withAttribute(name, value))).toContain(name);
  });

  test.each([
    ["transform", "translate(1 2) rotate(45)"],
    ["transform", "matrix(1,0,0,1,5.5,-3e2)"],
    ["gradientTransform", "scale(2) skewX(10)"],
    ["fill", "rgb(10, 20, 30)"],
    ["fill", "rgba(10,20,30,0.5)"],
    ["stroke", "hsl(120, 50%, 50%)"],
    ["stop-color", "hsla(120,50%,50%,0.3)"],
    ["fill", "#0f172a"],
    ["fill", "#fff"],
    ["fill", "none"],
    ["fill", "currentColor"],
    ["fill", "darkblue"],
  ])("accepts %s=%s", (name, value) => {
    expect(sanitise(withAttribute(name, value))).toEqual([]);
  });

  test.each([
    ["transform", "translate(1 2) foo(3)"],
    ["transform", "translate(1 2"],
    ["transform", "translate(url(#a))"],
    ["fill", "rgb(1 2 3) url(#a)"],
    ["fill", "rgb(url(#a))"],
    ["fill", "hsl(1,2%,3%);"],
    ["stop-color", "url(#a)"],
    ["color", "url(#a)"],
  ])("rejects the malformed value %s=%s", (name, value) => {
    expect(sanitise(withAttribute(name, value)).length).toBeGreaterThan(0);
  });

  test.each(["d", "points", "viewBox"])("rejects a quote, semicolon or colon in %s", (name) => {
    expect(sanitise(withAttribute(name, "0 0 1 1;x:y")).length).toBeGreaterThan(0);
  });

  test("keeps naming data:, javascript: and http: values", () => {
    expect(reasons(withAttribute("fill", "data:image/png;base64,AAAA"))).toContain("data:");
    expect(reasons(svg('<use href="javascript:alert(1)"/>'))).toContain("javascript:");
    expect(reasons(withAttribute("fill", "http://example.com/x"))).toContain("http:");
  });
});

describe("sanitise duplicate attributes", () => {
  test.each([
    ["fill", '<path fill="red" fill="url(//evil/x)"/>'],
    ["href", '<use href="#a" href="javascript:alert(1)"/>'],
    ["fill with a space around the equals sign", "<path fill = 'red' fill = 'blue'/>"],
    [
      "an xlink:href pair",
      '<use xlink:href="#a" xlink:href="#b" xmlns:xlink="http://www.w3.org/1999/xlink"/>',
    ],
    [
      "a duplicate on the root",
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" viewBox="0 0 2 2"/>',
    ],
  ])("rejects a repeated attribute: %s", (_name, body) => {
    const text = body.startsWith("<svg") ? body : svg(body);
    expect(sanitise(text).join("\n")).toContain("repeated");
  });

  test("does not mistake an attribute name inside a value for a repeat", () => {
    expect(sanitise(svg('<g id="fill=" fill="red"/>')).join("\n")).not.toContain("repeated");
  });

  test("allows the same attribute name on different elements", () => {
    expect(sanitise(svg('<g fill="red"><path fill="blue" d="M0 0"/></g>'))).toEqual([]);
  });
});

describe("sanitise reference limits", () => {
  const chain = (levels) => {
    const groups = Array.from({ length: levels }, (_, level) =>
      level === 0
        ? '<g id="a0"><rect width="1" height="1"/></g>'
        : `<g id="a${level}"><use href="#a${level - 1}"/><use href="#a${level - 1}"/></g>`,
    );
    return svg(`<defs>${groups.join("")}</defs><use href="#a${levels - 1}"/>`);
  };

  test("rejects an exponential chain of use elements and names the limit", () => {
    const report = sanitise(chain(30)).join("\n");
    expect(report).toContain(`more than ${MAX_USE_ELEMENTS} <use>`);
  });

  test("accepts a few use elements", () => {
    expect(sanitise(chain(4))).toEqual([]);
  });

  test("accepts exactly the use limit and rejects one more", () => {
    const uses = (count) => svg(`<defs><g id="a"/></defs>${'<use href="#a"/>'.repeat(count)}`);
    expect(sanitise(uses(MAX_USE_ELEMENTS))).toEqual([]);
    expect(sanitise(uses(MAX_USE_ELEMENTS + 1)).join("\n")).toContain("<use>");
  });

  test("rejects elements nested deeper than the limit and names it", () => {
    const nested = (levels) =>
      svg(`${"<g>".repeat(levels)}<rect width="1" height="1"/>${"</g>".repeat(levels)}`);
    expect(sanitise(nested(MAX_ELEMENT_DEPTH - 2))).toEqual([]);
    expect(sanitise(nested(MAX_ELEMENT_DEPTH + 1)).join("\n")).toContain(
      `nested deeper than ${MAX_ELEMENT_DEPTH}`,
    );
  });

  test("reports a limit once however far it is exceeded", () => {
    const report = sanitise(chain(30)).filter((line) => line.includes("<use>"));
    expect(report).toHaveLength(1);
  });
});
