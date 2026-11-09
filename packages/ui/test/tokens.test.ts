import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { blockDeclarations, readStyles } from "./support/css";

interface Shadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
}

interface TypeStyle {
  size: number;
  weight: number;
  lineHeight: number;
}

interface Tokens {
  colors: Record<"light" | "dark", Record<string, string>>;
  type: { styles: Record<string, TypeStyle> };
  radius: Record<string, number>;
  spacing: { base: number; scale: Record<string, number> };
  shadows: Record<"light" | "dark", Record<string, Shadow[]>>;
}

const tokens = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../../docs/design/tokens.json"), "utf8"),
) as Tokens;

const css = readStyles();
const light = blockDeclarations(css, ":root");
const dark = blockDeclarations(css, ".dark");
const theme = blockDeclarations(css, "@theme");

function rem(pixels: number): string {
  return `${pixels / 16}rem`;
}

function shadowValue(layers: Shadow[]): string {
  return layers
    .map((layer) => {
      const alpha = Math.round(layer.opacity * 100);
      return `${layer.x}px ${layer.y}px ${layer.blur}px ${layer.spread}px color-mix(in srgb, ${layer.color} ${alpha}%, transparent)`;
    })
    .join(", ");
}

describe("colour roles", () => {
  test.each(["light", "dark"] as const)("every %s role has the exported value", (mode) => {
    const declared = mode === "light" ? light : dark;
    for (const [role, value] of Object.entries(tokens.colors[mode])) {
      expect(declared.get(`--${role}`), `${mode} ${role}`).toBe(value);
    }
  });

  test("no colour role exists in one theme only", () => {
    const colourNames = (declared: Map<string, string>) =>
      [...declared]
        .filter(([, value]) => value.startsWith("#"))
        .map(([name]) => name)
        .sort();
    expect(colourNames(dark)).toEqual(colourNames(light));
    expect(colourNames(light)).toEqual(
      Object.keys(tokens.colors.light)
        .map((role) => `--${role}`)
        .sort(),
    );
  });
});

describe("fixed tokens", () => {
  test("radius steps", () => {
    for (const [name, pixels] of Object.entries(tokens.radius)) {
      const expected = name === "full" ? "9999px" : rem(pixels);
      expect(theme.get(`--radius-${name}`), name).toBe(expected);
    }
  });

  test("spacing base and scale", () => {
    expect(theme.get("--spacing")).toBe(rem(tokens.spacing.base));
    for (const [step, pixels] of Object.entries(tokens.spacing.scale)) {
      expect(pixels).toBe(Number(step) * tokens.spacing.base);
    }
  });

  test("type styles carry size, line height and weight", () => {
    for (const [name, style] of Object.entries(tokens.type.styles)) {
      expect(theme.get(`--text-${name}`), name).toBe(rem(style.size));
      expect(theme.get(`--text-${name}--line-height`), name).toBe(rem(style.lineHeight));
      expect(theme.get(`--text-${name}--font-weight`), name).toBe(String(style.weight));
    }
  });

  test("body text is not under 16 px", () => {
    expect(tokens.type.styles["body"]?.size).toBeGreaterThanOrEqual(16);
    expect(theme.get("--text-body")).toBe("1rem");
  });
});

describe("shadows", () => {
  test.each(["light", "dark"] as const)("%s shadows have the exported layers", (mode) => {
    const declared = mode === "light" ? light : dark;
    for (const [size, layers] of Object.entries(tokens.shadows[mode])) {
      expect(declared.get(`--elevation-${size}`), `${mode} ${size}`).toBe(shadowValue(layers));
    }
  });
});
