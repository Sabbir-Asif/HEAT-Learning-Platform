import { describe, expect, test } from "vitest";
import {
  clampPage,
  defaultPageSize,
  nextSort,
  pageCount,
  pageSizes,
  parsePage,
  parsePageSize,
  parseSort,
  rangeText,
  serializeSort,
  validatePageInput,
} from "../../src/data/url-state";

describe("page size", () => {
  test("allows 10, 25 and 50 with 25 as the default", () => {
    expect(pageSizes).toEqual([10, 25, 50]);
    expect(defaultPageSize).toBe(25);
  });

  test.each(["10", "25", "50"])("accepts %s", (raw) => {
    expect(parsePageSize(raw)).toBe(Number(raw));
  });

  test.each([null, "", "0", "7", "100", "-10", "abc", "10.5", "25px"])(
    "falls back to the default for %j",
    (raw) => {
      expect(parsePageSize(raw)).toBe(defaultPageSize);
    },
  );
});

describe("page", () => {
  test("reads a positive integer", () => {
    expect(parsePage("3")).toBe(3);
  });

  test.each([null, "", "0", "-2", "x", "1.5", "2e3"])("falls back to 1 for %j", (raw) => {
    expect(parsePage(raw)).toBe(1);
  });

  test("pageCount is at least one", () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(25, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
    expect(pageCount(134, 10)).toBe(14);
  });

  test("clamps a page past the end to the last page", () => {
    expect(clampPage(9, 134, 25)).toBe(6);
    expect(clampPage(3, 0, 25)).toBe(1);
    expect(clampPage(2, 134, 25)).toBe(2);
  });
});

describe("sort", () => {
  const sortable = ["name", "createdAt"];

  test("reads ascending and descending sorts on sortable columns", () => {
    expect(parseSort("name", sortable)).toEqual({ id: "name", desc: false });
    expect(parseSort("-createdAt", sortable)).toEqual({ id: "createdAt", desc: true });
  });

  test.each([null, "", "-", "email", "-email", "name,createdAt", "name desc"])(
    "gives no sort for %j",
    (raw) => {
      expect(parseSort(raw, sortable)).toBeNull();
    },
  );

  test("serializes back to the URL form", () => {
    expect(serializeSort({ id: "name", desc: false })).toBe("name");
    expect(serializeSort({ id: "name", desc: true })).toBe("-name");
    expect(serializeSort(null)).toBeNull();
  });

  test("cycles ascending, descending, none on the same column", () => {
    const first = nextSort(null, "name");
    expect(first).toEqual({ id: "name", desc: false });
    const second = nextSort(first, "name");
    expect(second).toEqual({ id: "name", desc: true });
    expect(nextSort(second, "name")).toBeNull();
  });

  test("starts ascending when another column was sorted", () => {
    expect(nextSort({ id: "createdAt", desc: true }, "name")).toEqual({ id: "name", desc: false });
  });
});

describe("rangeText", () => {
  test("shows the visible range and the total", () => {
    expect(rangeText(2, 10, 134)).toBe("11 to 20 of 134");
  });

  test("ends at the total on the last page", () => {
    expect(rangeText(6, 25, 134)).toBe("126 to 134 of 134");
  });

  test("handles an empty result and a single row", () => {
    expect(rangeText(1, 25, 0)).toBe("0 results");
    expect(rangeText(1, 25, 1)).toBe("1 to 1 of 1");
  });
});

describe("go to page input", () => {
  test.each([
    ["3", 3],
    [" 4 ", 4],
  ])("accepts %j", (raw, value) => {
    expect(validatePageInput(raw, 6)).toEqual({ ok: true, page: value });
  });

  test.each(["", " ", "0", "7", "-1", "2.5", "abc", "1e1"])("rejects %j with a message", (raw) => {
    const result = validatePageInput(raw, 6);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("6");
  });
});
