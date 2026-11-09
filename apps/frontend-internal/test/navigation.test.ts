import { existsSync } from "node:fs";
import { join } from "node:path";
import { findActiveHref } from "@heat/ui/shell";
import { describe, expect, test } from "vitest";
import { routeManifest, routePaths } from "../src/routes/manifest";
import { buildBreadcrumbs } from "../src/shell/breadcrumbs";
import { adminNavigation } from "../src/shell/navigation";

const appRoot = join(import.meta.dirname, "../src/app");
const flat = (superAdmin?: boolean) => adminNavigation(superAdmin).flatMap((group) => group.items);

describe("admin navigation", () => {
  test("groups follow the route map", () => {
    expect(adminNavigation().map((group) => group.label)).toEqual([
      "Overview",
      "Students",
      "Courses",
      "Media",
      "Directory",
      "Site content",
      "Administration",
    ]);
  });

  test("admins are hidden for anyone but a super admin", () => {
    expect(flat(true).some((item) => item.href === "/admins")).toBe(true);
    expect(flat(false).some((item) => item.href === "/admins")).toBe(false);
  });

  test("nested routes keep the parent item active", () => {
    const items = flat();
    expect(findActiveHref(items, "/courses/7/modules/2")).toBe("/courses");
    expect(findActiveHref(items, "/content/news/9")).toBe("/content/news");
    expect(findActiveHref(items, "/")).toBe("/");
  });

  test("every item points to a route in the manifest", () => {
    for (const item of flat()) expect(routePaths).toContain(item.href);
  });
});

describe("breadcrumbs", () => {
  const groups = adminNavigation();

  test("the overview is a single current crumb", () => {
    expect(buildBreadcrumbs("/", groups)).toEqual([{ label: "Overview" }]);
  });

  test("a grouped page shows its group then itself", () => {
    expect(buildBreadcrumbs("/directory/faculties", groups)).toEqual([
      { label: "Overview", href: "/" },
      { label: "Directory" },
      { label: "Faculties" },
    ]);
  });

  test("a page whose group has the same name does not repeat it", () => {
    expect(buildBreadcrumbs("/courses", groups)).toEqual([
      { label: "Overview", href: "/" },
      { label: "Courses" },
    ]);
  });

  test("nested paths add readable trailing crumbs and link their parent", () => {
    expect(buildBreadcrumbs("/courses/7/modules/2", groups)).toEqual([
      { label: "Overview", href: "/" },
      { label: "Courses", href: "/courses" },
      { label: "Details" },
      { label: "Modules" },
      { label: "Details" },
    ]);
    expect(buildBreadcrumbs("/students/new", groups).at(-1)).toEqual({ label: "New" });
  });

  test("an unknown path falls back to the overview", () => {
    expect(buildBreadcrumbs("/nowhere", groups)).toEqual([{ label: "Overview", href: "/" }]);
  });
});

describe("route manifest", () => {
  test.each(routeManifest.map((route) => [route.pattern, route]))(
    "%s has a page in its layout group",
    (_pattern, route) => {
      const page = join(appRoot, `(${route.kind})`, route.pattern, "page.tsx");
      expect(existsSync(page)).toBe(true);
    },
  );

  test("sample paths are concrete and unique", () => {
    expect(routePaths.every((path) => !path.includes("["))).toBe(true);
    expect(new Set(routePaths).size).toBe(routePaths.length);
  });

  test("each layout group has loading and error states", () => {
    for (const kind of ["admin", "auth"]) {
      expect(existsSync(join(appRoot, `(${kind})`, "loading.tsx"))).toBe(true);
      expect(existsSync(join(appRoot, `(${kind})`, "error.tsx"))).toBe(true);
    }
  });
});
