import type { CaptchaEntropy } from "./captcha-entropy";
import { glyphHeight, glyphWidth, glyphs } from "./captcha-glyphs";
import type { Point } from "./captcha-glyphs";

const canvasWidth = 190;
const canvasHeight = 64;
const scale = 4.4;
const slot = canvasWidth / 6.4;
const background = "#f4f1ea";
const ink = "#1d2733";
const noiseInk = "#6b7685";

const fixed = (value: number): string => value.toFixed(1);

const spread = (entropy: CaptchaEntropy, amount: number): number =>
  (entropy.unit() * 2 - 1) * amount;

const transformPoint = (
  [x, y]: Point,
  originX: number,
  originY: number,
  angle: number,
  shear: number,
  entropy: CaptchaEntropy,
): Point => {
  const centredX = (x - glyphWidth / 2) * scale + spread(entropy, 1.1);
  const centredY = (y - glyphHeight / 2) * scale + spread(entropy, 1.1);
  const sheared = centredX + shear * centredY;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [originX + sheared * cos - centredY * sin, originY + sheared * sin + centredY * cos];
};

const pathData = (points: readonly Point[]): string =>
  points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${fixed(x)} ${fixed(y)}`).join(" ");

const glyphPaths = (character: string, index: number, entropy: CaptchaEntropy): string[] => {
  const strokes = glyphs[character] ?? [];
  const originX = slot * (index + 0.8) + spread(entropy, 3);
  const originY = canvasHeight / 2 + spread(entropy, 4);
  const angle = spread(entropy, 0.3);
  const shear = spread(entropy, 0.25);
  const width = 2 + entropy.unit() * 0.7;
  return strokes.map((stroke) => {
    const points = stroke.map((point) =>
      transformPoint(point, originX, originY, angle, shear, entropy),
    );
    return `<path d="${pathData(points)}" fill="none" stroke="${ink}" stroke-width="${fixed(width)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
};

const noiseCurve = (entropy: CaptchaEntropy): string => {
  const startY = entropy.unit() * canvasHeight;
  const endY = entropy.unit() * canvasHeight;
  const controlOne = entropy.unit() * canvasHeight;
  const controlTwo = entropy.unit() * canvasHeight;
  return `<path d="M0 ${fixed(startY)} C${fixed(canvasWidth / 3)} ${fixed(controlOne)} ${fixed((canvasWidth * 2) / 3)} ${fixed(controlTwo)} ${canvasWidth} ${fixed(endY)}" fill="none" stroke="${noiseInk}" stroke-width="1.2" stroke-opacity="0.7"/>`;
};

const speck = (entropy: CaptchaEntropy): string =>
  `<circle cx="${fixed(entropy.unit() * canvasWidth)}" cy="${fixed(entropy.unit() * canvasHeight)}" r="${fixed(0.6 + entropy.unit() * 0.8)}" fill="${noiseInk}" fill-opacity="0.6"/>`;

export const renderCaptchaSvg = (text: string, entropy: CaptchaEntropy): string => {
  const letters = [...text].flatMap((character, index) => glyphPaths(character, index, entropy));
  const curves = Array.from({ length: 4 }, () => noiseCurve(entropy));
  const specks = Array.from({ length: 24 }, () => speck(entropy));
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth} ${canvasHeight}" width="${canvasWidth}" height="${canvasHeight}">`,
    `<rect width="${canvasWidth}" height="${canvasHeight}" fill="${background}"/>`,
    ...specks,
    ...letters,
    ...curves,
    "</svg>",
  ].join("");
};
