import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contrastRatio } from "@heat/config";
import { describe, expect, test } from "vitest";
import { blockDeclarations, readStyles } from "./support/css";

interface Pair {
  foreground: string;
  background: string;
  kind: "text" | "non-text";
  exempt?: string;
}

const { pairs } = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../../docs/design/tokens.json"), "utf8"),
) as { pairs: Pair[] };

const css = readStyles();
const themes = {
  light: blockDeclarations(css, ":root"),
  dark: blockDeclarations(css, ".dark"),
};
const required = { text: 4.5, "non-text": 3 };

function ratioOf(mode: keyof typeof themes, pair: Pair): number {
  const foreground = themes[mode].get(`--${pair.foreground}`);
  const background = themes[mode].get(`--${pair.background}`);
  if (!foreground || !background) throw new Error(`${mode} ${pair.foreground}/${pair.background}`);
  return contrastRatio(foreground, background);
}

describe.each(["light", "dark"] as const)("%s theme contrast", (mode) => {
  test.each(pairs.filter((pair) => !pair.exempt))(
    "$foreground on $background meets its ratio",
    (pair) => {
      const ratio = ratioOf(mode, pair);
      expect(
        ratio,
        `${mode} ${pair.foreground} on ${pair.background} is ${ratio.toFixed(2)}:1, needs ${required[pair.kind]}:1`,
      ).toBeGreaterThanOrEqual(required[pair.kind]);
    },
  );

  test("the focus ring is 3:1 on background and card", () => {
    for (const background of ["background", "card"]) {
      const ratio = ratioOf(mode, { foreground: "ring", background, kind: "non-text" });
      expect(ratio, `${mode} ring on ${background}`).toBeGreaterThanOrEqual(3);
    }
  });
});
