import { HomeIcon } from "lucide-react";
import { describe, expect, test } from "vitest";
import { capCount, findActiveHref, isActivePath, visibleGroups } from "../../src/shell/nav";

describe("isActivePath", () => {
  test("matches the exact path and nested paths", () => {
    expect(isActivePath("/learn", "/learn")).toBe(true);
    expect(isActivePath("/learn/course/module", "/learn")).toBe(true);
    expect(isActivePath("/learning", "/learn")).toBe(false);
  });

  test("the root only matches itself", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/students", "/")).toBe(false);
  });

  test("an exact item ignores nested paths", () => {
    expect(isActivePath("/courses/1", "/courses", true)).toBe(false);
  });

  test("ignores a trailing slash, query string and hash", () => {
    expect(isActivePath("/learn/", "/learn")).toBe(true);
    expect(isActivePath("/learn?page=2", "/learn")).toBe(true);
    expect(isActivePath("/learn#top", "/learn")).toBe(true);
  });
});

describe("findActiveHref", () => {
  const items = [{ href: "/" }, { href: "/content" }, { href: "/content/news" }];

  test("picks the most specific match", () => {
    expect(findActiveHref(items, "/content/news/4")).toBe("/content/news");
    expect(findActiveHref(items, "/content/tags")).toBe("/content");
  });

  test("returns undefined when nothing matches", () => {
    expect(findActiveHref([{ href: "/a" }], "/b")).toBeUndefined();
  });
});

describe("visibleGroups", () => {
  const groups = [
    { label: "One", items: [{ href: "/a", label: "A", icon: HomeIcon }] },
    { label: "Two", items: [{ href: "/b", label: "B", icon: HomeIcon, hidden: true }] },
  ];

  test("drops hidden items and the groups left empty", () => {
    expect(visibleGroups(groups).map((group) => group.label)).toEqual(["One"]);
  });
});

describe("capCount", () => {
  test("shows the number up to 99 and 99+ above", () => {
    expect(capCount(0)).toBeUndefined();
    expect(capCount(7)).toBe("7");
    expect(capCount(99)).toBe("99");
    expect(capCount(100)).toBe("99+");
  });
});
