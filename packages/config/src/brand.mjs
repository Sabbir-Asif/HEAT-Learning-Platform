import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sax from "sax";
import { optimize } from "svgo";
import svgoConfig from "../svgo.config.mjs";

export const MAX_SVG_BYTES = 20 * 1024;
export const PIXEL_DIFFERENCE_LIMIT = 0.002;
export const PIXEL_CHANNEL_TOLERANCE = 8;
export const COMPARISON_WIDTH = 512;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";

const allowedElements = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "use",
]);

const allowedAttributes = new Set([
  "id",
  "class",
  "viewBox",
  "preserveAspectRatio",
  "version",
  "xmlns",
  "xmlns:xlink",
  "href",
  "xlink:href",
  "x",
  "y",
  "width",
  "height",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x1",
  "y1",
  "x2",
  "y2",
  "fx",
  "fy",
  "points",
  "d",
  "transform",
  "fill",
  "fill-opacity",
  "fill-rule",
  "clip-rule",
  "clip-path",
  "mask",
  "opacity",
  "color",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stop-color",
  "stop-opacity",
  "offset",
  "gradientUnits",
  "gradientTransform",
  "spreadMethod",
  "clipPathUnits",
  "maskUnits",
  "maskContentUnits",
  "display",
  "visibility",
]);

const namedElements = new Map([
  ["foreignObject", "can embed HTML"],
  ["script", "runs code"],
  ["style", "use presentation attributes instead"],
  ["image", "embeds a raster file"],
  ["a", "makes a link"],
  ["animate", "animates"],
  ["set", "animates"],
  ["iframe", "embeds a page"],
  ["embed", "embeds a file"],
  ["text", "convert text to outlines"],
  ["tspan", "convert text to outlines"],
]);

const forbiddenValues = [
  ["data:", /data:/i],
  ["javascript:", /javascript:/i],
  ["http:", /http:/i],
  ["https:", /https:/i],
  ["//", /(^|[\s(,'"])\/\//],
];

const fragment = /^#[A-Za-z_][\w.-]*$/;
const urlCall = /url\(\s*([^)]*?)\s*\)/gi;
const eventHandler = /^on/i;

function checkAttribute(element, name, value, add) {
  if (eventHandler.test(name)) return add(`event handler attribute ${name} on <${element}>`);
  if (name === "style") return add(`style attribute on <${element}>`);
  if (name === "xmlns") {
    if (value !== SVG_NAMESPACE) add(`xmlns must be ${SVG_NAMESPACE}`);
    return;
  }
  if (name === "xmlns:xlink") {
    if (value !== XLINK_NAMESPACE) add(`xmlns:xlink must be ${XLINK_NAMESPACE}`);
    return;
  }
  if (!allowedAttributes.has(name)) return add(`attribute ${name} on <${element}> is not allowed`);
  for (const [label, pattern] of forbiddenValues)
    if (pattern.test(value)) add(`${label} value in ${name} on <${element}>`);
  if ((name === "href" || name === "xlink:href") && !fragment.test(value))
    add(`${name} on <${element}> must be a #fragment, found ${value.slice(0, 40)}`);
  for (const [, target] of value.matchAll(urlCall))
    if (!fragment.test(target)) add(`url( ) in ${name} on <${element}> must point to a #fragment`);
}

export function sanitise(source) {
  const found = new Set();
  const add = (message) => found.add(message);
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;

  if (Buffer.byteLength(source) > MAX_SVG_BYTES) add(`file is larger than 20 KB`);

  const parser = sax.parser(true, { lowercase: false });
  let depth = 0;
  let sawRoot = false;
  let failed = false;

  parser.onerror = (error) => {
    failed = true;
    add(`not well-formed XML: ${error.message.split("\n")[0]}`);
  };
  parser.ondoctype = () => add("<!DOCTYPE and <!ENTITY declarations are not allowed");
  parser.onprocessinginstruction = ({ name }) => {
    if (name !== "xml") add(`processing instruction ${name} is not allowed`);
  };
  parser.ontext = (content) => {
    if (content.trim()) add("text content is not allowed, convert text to outlines");
  };
  parser.oncdata = () => add("CDATA is not allowed");
  parser.onopentag = ({ name, attributes }) => {
    if (depth === 0) {
      sawRoot = true;
      if (name !== "svg") add(`the root element must be <svg>, found <${name}>`);
      else if (!("viewBox" in attributes)) add("the <svg> element needs a viewBox");
    }
    depth += 1;
    if (namedElements.has(name))
      add(`<${name}> element is not allowed: ${namedElements.get(name)}`);
    else if (!allowedElements.has(name)) add(`<${name}> element is not allowed`);
    for (const [attribute, value] of Object.entries(attributes))
      checkAttribute(name, attribute, value, add);
  };
  parser.onclosetag = () => {
    depth -= 1;
  };

  try {
    parser.write(text).close();
  } catch (error) {
    if (!failed) add(`not well-formed XML: ${error.message.split("\n")[0]}`);
  }
  if (!sawRoot && !failed) add("not well-formed XML: no <svg> element");
  if (!sawRoot && failed) add("the root element must be <svg>");
  return [...found];
}

const normalise = (source) => {
  const withoutMark = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  return withoutMark.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
};

export function optimise(source) {
  const { data } = optimize(normalise(source), svgoConfig);
  if (!data) throw new Error("SVGO produced no output, the source is not a complete SVG");
  return data;
}

export function render(source, { width, height, background }) {
  const fitTo = height ? { mode: "height", value: height } : { mode: "width", value: width };
  const image = new Resvg(source, {
    fitTo,
    background,
    font: { loadSystemFonts: false },
  }).render();
  return { width: image.width, height: image.height, pixels: image.pixels };
}

export function pixelDifference(before, after, width = COMPARISON_WIDTH) {
  const a = render(before, { width, background: "#ffffff" });
  const b = render(after, { width, background: "#ffffff" });
  if (a.width !== b.width || a.height !== b.height) return 1;
  let differing = 0;
  for (let i = 0; i < a.pixels.length; i += 4)
    for (let channel = 0; channel < 4; channel++)
      if (Math.abs(a.pixels[i + channel] - b.pixels[i + channel]) > PIXEL_CHANNEL_TOLERANCE) {
        differing += 1;
        break;
      }
  return differing / (a.pixels.length / 4);
}

export const brandLocation = (root) => ({
  sourceDir: resolve(root, "packages/config/brand/source"),
  targetDirs: [
    resolve(root, "apps/frontend-public/public/brand"),
    resolve(root, "apps/frontend-internal/public/brand"),
  ],
});

const svgNames = (dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith(".svg"))
    .sort();

const readIfPresent = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

const namesIn = (dir) => {
  try {
    return readdirSync(dir).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
};

function optimisedSources(sourceDir) {
  return svgNames(sourceDir).map((name) => {
    const source = readFileSync(join(sourceDir, name), "utf8");
    const failures = sanitise(source);
    if (failures.length)
      throw new Error(`${name} fails the sanitiser:\n  ${failures.join("\n  ")}`);
    const output = optimise(source);
    const afterFailures = sanitise(output);
    if (afterFailures.length)
      throw new Error(`${name} fails the sanitiser after SVGO:\n  ${afterFailures.join("\n  ")}`);
    return { name, output };
  });
}

export function buildBrand({ sourceDir, targetDirs }) {
  const outputs = optimisedSources(sourceDir);
  const written = [];
  for (const dir of targetDirs) {
    mkdirSync(dir, { recursive: true });
    const wanted = new Set(outputs.map(({ name }) => name));
    for (const name of namesIn(dir))
      if (!wanted.has(name)) {
        rmSync(join(dir, name), { recursive: true, force: true });
        written.push(join(dir, name));
      }
    for (const { name, output } of outputs) {
      const path = join(dir, name);
      if (readIfPresent(path) === output) continue;
      writeFileSync(path, output);
      written.push(path);
    }
  }
  return { written };
}

export function checkBrand({ sourceDir, targetDirs }) {
  const problems = [];
  let outputs;
  try {
    outputs = optimisedSources(sourceDir);
  } catch (error) {
    return [error.message];
  }
  const wanted = new Map(outputs.map(({ name, output }) => [name, output]));
  for (const dir of targetDirs) {
    for (const name of namesIn(dir))
      if (!wanted.has(name))
        problems.push(`${join(dir, name)} is a stray file, no source produces it`);
    for (const [name, output] of wanted) {
      const path = join(dir, name);
      const actual = readIfPresent(path);
      if (actual === null) problems.push(`${path} is missing, run pnpm brand`);
      else if (actual !== output) {
        const failures = sanitise(actual);
        problems.push(
          failures.length
            ? `${path} fails the sanitiser: ${failures.join("; ")}`
            : `${path} differs from the optimised source, run pnpm brand`,
        );
      }
    }
  }
  return problems;
}

export const LEGIBLE_HEIGHT = 40;
export const LEGIBLE_SCALES = [1, 2];
export const MAX_LOW_CONTRAST_SHARE = 0.1;
export const MIN_PAINTED_SHARE = 0.01;
export const MIN_CONTRAST = 3;
const PAINTED_ALPHA = 128;

const hexChannels = (hex) => {
  const digits = hex.length === 4 ? [...hex.slice(1)].map((d) => d + d) : hex.slice(1).match(/../g);
  return digits.map((pair) => parseInt(pair, 16));
};

const luminance = ([red, green, blue]) => {
  const linear = (value) => {
    const unit = value / 255;
    return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
};

export function contrastRatio(first, second) {
  const a = luminance(typeof first === "string" ? hexChannels(first) : first);
  const b = luminance(typeof second === "string" ? hexChannels(second) : second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const hexColour = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function readThemeBackgrounds(css) {
  const backgroundIn = (selector) => {
    const block = css.match(new RegExp(`(?:^|[\\s}])${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
    const value = block.match(/--background\s*:\s*([^;]+?)\s*(?:;|$)/)?.[1];
    if (!value || !hexColour.test(value))
      throw new Error(
        `${selector} must define --background as a hex colour; update readThemeBackgrounds if the tokens moved`,
      );
    return value.toLowerCase();
  };
  return { light: backgroundIn(":root"), dark: backgroundIn("\\.dark") };
}

export function legibility(source, background) {
  const backgroundChannels = hexChannels(background);
  const problems = [];
  const renders = LEGIBLE_SCALES.map((scale) => {
    const height = LEGIBLE_HEIGHT * scale;
    const { width, pixels } = render(source, { height });
    let painted = 0;
    let lowContrast = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3];
      if (alpha < PAINTED_ALPHA) continue;
      painted += 1;
      const colour = [0, 1, 2].map(
        (c) => pixels[i + c] + backgroundChannels[c] * (1 - alpha / 255),
      );
      if (contrastRatio(colour, backgroundChannels) < MIN_CONTRAST) lowContrast += 1;
    }
    const canvas = pixels.length / 4;
    const paintedShare = painted / canvas;
    const lowShare = painted ? lowContrast / painted : 0;
    if (paintedShare < MIN_PAINTED_SHARE)
      problems.push(
        `at ${height} px high on ${background} only ${(paintedShare * 100).toFixed(2)}% of the canvas is painted, at least 1% is needed`,
      );
    else if (lowShare > MAX_LOW_CONTRAST_SHARE)
      problems.push(
        `at ${height} px high on ${background} ${(lowShare * 100).toFixed(1)}% of painted pixels have contrast under ${MIN_CONTRAST}:1, at most 10% is allowed`,
      );
    return { height, width, paintedShare, lowShare };
  });
  return { problems, renders };
}
