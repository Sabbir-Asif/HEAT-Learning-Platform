import { expect, test } from "@playwright/test";
import { settle, themes, viewportFor, widthNames, widths } from "./matrix";

export interface ScreenshotPage {
  name: string;
  path: string;
}

export function defineScreenshotSuite(app: string, pages: ReadonlyArray<ScreenshotPage>) {
  for (const width of widthNames) {
    for (const theme of themes) {
      test.describe(`${width} ${theme}`, () => {
        test.use({ viewport: viewportFor(width), colorScheme: theme });

        for (const { name, path } of pages) {
          test(`${name} matches its baseline`, async ({ page }) => {
            await page.goto(path);
            await settle(page, theme);
            await expect(page).toHaveScreenshot(`${app}-${name}-${widths[width]}-${theme}.png`, {
              fullPage: true,
            });
          });
        }
      });
    }
  }
}
