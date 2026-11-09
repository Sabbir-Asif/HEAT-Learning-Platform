import type { Page } from "@playwright/test";

export interface AppRoute {
  pattern: string;
  path: string;
  kind: string;
}

export const widths = { phone: 390, laptop: 1440 } as const;
export const themes = ["light", "dark"] as const;

export type WidthName = keyof typeof widths;
export type Theme = (typeof themes)[number];

export const widthNames = Object.keys(widths) as WidthName[];

export function viewportFor(width: WidthName) {
  return { width: widths[width], height: width === "phone" ? 844 : 900 };
}

export async function settle(page: Page, theme: Theme) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    (expectDark) => document.documentElement.classList.contains("dark") === expectDark,
    theme === "dark",
  );
}
