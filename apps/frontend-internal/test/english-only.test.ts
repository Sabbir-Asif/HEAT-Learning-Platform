import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const app = join(import.meta.dirname, "..");
const exists = (path: string) => existsSync(join(app, path));

test("the admin console has no proxy, no locale segment and no next-intl dependency", () => {
  const manifest = JSON.parse(readFileSync(join(app, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const dependencies = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  expect(exists("src/proxy.ts")).toBe(false);
  expect(exists("src/middleware.ts")).toBe(false);
  expect(exists("src/app/[locale]")).toBe(false);
  expect(dependencies).not.toContain("next-intl");
});

test("the root layout is English", () => {
  const layout = readFileSync(join(app, "src/app/layout.tsx"), "utf8");
  expect(layout).toContain('<html lang="en">');
});
