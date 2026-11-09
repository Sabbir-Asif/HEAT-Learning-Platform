const SHORT_HEX = /^#[0-9a-f]{3}$/i;
const LONG_HEX = /^#[0-9a-f]{6}$/i;

export function parseHex(value) {
  if (typeof value !== "string" || !(SHORT_HEX.test(value) || LONG_HEX.test(value))) {
    throw new Error(`Not an opaque hex colour: ${JSON.stringify(value)}`);
  }
  const digits =
    value.length === 4
      ? [...value.slice(1)].map((d) => d + d)
      : [1, 3, 5].map((i) => value.slice(i, i + 2));
  return digits.map((pair) => Number.parseInt(pair, 16));
}

const linear = (channel) => {
  const scaled = channel / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(hex) {
  const [red, green, blue] = parseHex(hex).map(linear);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
