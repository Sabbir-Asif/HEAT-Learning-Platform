import designTokens from "../../../../docs/design/tokens.json";

export type ThemeName = "light" | "dark";

export interface TypeStyle {
  size: number;
  weight: number;
  lineHeight: number;
}

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
}

export interface DesignTokens {
  colors: Record<ThemeName, Record<string, string>>;
  type: { styles: Record<string, TypeStyle> };
  radius: Record<string, number>;
  spacing: { base: number; scale: Record<string, number> };
  shadows: Record<ThemeName, Record<string, Shadow[]>>;
}

export const tokens: DesignTokens = designTokens;

export function describeShadow(layers: Shadow[]): string {
  return layers
    .map(
      (layer) =>
        `${layer.x} ${layer.y} ${layer.blur} ${layer.spread} ${layer.color} ${Math.round(layer.opacity * 100)}%`,
    )
    .join(", ");
}
