import { expect, test } from "@playwright/test";
import { scan } from "./axe";
import { settle, themes, viewportFor, widthNames, type AppRoute } from "./matrix";

export function defineAccessibilitySuite(routes: ReadonlyArray<AppRoute>) {
  for (const width of widthNames) {
    for (const theme of themes) {
      test.describe(`${width} ${theme}`, () => {
        test.use({ viewport: viewportFor(width), colorScheme: theme });

        for (const route of routes) {
          test(`${route.path} has no WCAG 2.2 A or AA violations`, async ({ page }) => {
            await page.goto(route.path);
            await settle(page, theme);
            expect(await scan(page)).toEqual([]);
          });
        }
      });
    }
  }

  test.describe("theme switch", () => {
    test.use({ viewport: viewportFor("laptop"), colorScheme: "light" });

    test("choosing Dark applies the dark theme without violations", async ({ page }) => {
      await page.goto("/");
      await settle(page, "light");
      await page.getByRole("button", { name: "Choose theme" }).click();
      await page.getByRole("menuitemradio", { name: "Dark" }).click();
      await settle(page, "dark");
      expect(await scan(page)).toEqual([]);
    });
  });

  test.describe("keyboard focus", () => {
    test.use({ viewport: viewportFor("laptop") });

    const layouts = new Map<string, string>();
    for (const route of routes) {
      if (!layouts.has(route.kind)) layouts.set(route.kind, route.path);
    }

    for (const theme of themes) {
      for (const [kind, path] of layouts) {
        test(`${kind} ${path} shows a focus indicator on its first tab stops in ${theme}`, async ({
          page,
        }) => {
          await page.emulateMedia({ colorScheme: theme });
          await page.goto(path);
          await settle(page, theme);
          const stops: string[] = [];
          for (let stop = 1; stop <= 4; stop += 1) {
            await page.keyboard.press("Tab");
            const indicator = await page.evaluate(() => {
              const active = document.activeElement;
              if (!active || active === document.body) return null;
              const style = getComputedStyle(active);
              const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
              const shadow = style.boxShadow !== "none";
              return outline || shadow
                ? "visible"
                : `no indicator on ${active.outerHTML.slice(0, 120)}`;
            });
            if (indicator === null) break;
            stops.push(indicator);
          }
          expect(stops.length).toBeGreaterThan(0);
          expect(stops.filter((stop) => stop !== "visible")).toEqual([]);
        });
      }
    }
  });
}
