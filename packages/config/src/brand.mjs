import sax from "sax";

export const MAX_SVG_BYTES = 20 * 1024;

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
