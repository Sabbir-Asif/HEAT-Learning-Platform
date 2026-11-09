import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { routeManifest, routePaths } from "../src/routes/manifest";
import {
  footerColumns,
  learnerNavigation,
  legalLinks,
  publicNavigation,
} from "../src/shell/navigation";

const appRoot = join(import.meta.dirname, "../src/app");

describe("route manifest", () => {
  test.each(routeManifest.map((route) => [route.pattern, route]))(
    "%s has a page in its layout group",
    (_pattern, route) => {
      const page = join(appRoot, `(${route.kind})`, route.pattern, "page.tsx");
      expect(existsSync(page)).toBe(true);
    },
  );

  test("every sample path is concrete and unique", () => {
    expect(routePaths.every((path) => !path.includes("["))).toBe(true);
    expect(new Set(routePaths).size).toBe(routePaths.length);
  });

  test("each layout group has loading and error states", () => {
    for (const kind of ["public", "learner", "auth"]) {
      expect(existsSync(join(appRoot, `(${kind})`, "loading.tsx"))).toBe(true);
      expect(existsSync(join(appRoot, `(${kind})`, "error.tsx"))).toBe(true);
    }
  });

  test("covers the learner, auth and public areas", () => {
    const kinds = new Set(routeManifest.map((route) => route.kind));
    expect([...kinds].sort()).toEqual(["auth", "learner", "public"]);
  });
});

describe("navigation", () => {
  const known = new Set(routePaths);

  test("the learner bar has exactly five items", () => {
    expect(learnerNavigation.map((item) => item.label)).toEqual([
      "Dashboard",
      "My Learning",
      "Certificates",
      "Resources",
      "Profile",
    ]);
  });

  test("the public nav matches the spec", () => {
    expect(publicNavigation.map((item) => item.label)).toEqual([
      "Home",
      "About",
      "Training Modules",
      "Resources",
      "News",
      "Contact",
    ]);
  });

  test("every internal link points to a route that exists", () => {
    const hrefs = [
      ...publicNavigation,
      ...learnerNavigation,
      ...footerColumns.flatMap((column) => column.links),
      ...legalLinks,
    ]
      .map((item) => item.href)
      .filter((href) => href.startsWith("/"));
    for (const href of hrefs) expect(known.has(href)).toBe(true);
  });

  test("no link leaves for an admin path or host", () => {
    const hrefs = [
      ...publicNavigation,
      ...footerColumns.flatMap((c) => c.links),
      ...legalLinks,
    ].map((item) => item.href);
    expect(hrefs.some((href) => /admin/i.test(href))).toBe(false);
  });
});
