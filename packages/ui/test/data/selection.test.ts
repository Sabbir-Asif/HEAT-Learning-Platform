import { describe, expect, test } from "vitest";
import { pageSelectionState, toggleId, togglePage } from "../../src/data/selection";

describe("toggleId", () => {
  test("adds a missing id and removes a present one without mutating the input", () => {
    const start: ReadonlySet<string> = new Set(["a"]);

    expect([...toggleId(start, "b")]).toEqual(["a", "b"]);
    expect([...toggleId(start, "a")]).toEqual([]);
    expect([...start]).toEqual(["a"]);
  });
});

describe("pageSelectionState", () => {
  test("reports none, some and all of the page ids", () => {
    expect(pageSelectionState(new Set(), ["a", "b"])).toBe("none");
    expect(pageSelectionState(new Set(["a"]), ["a", "b"])).toBe("some");
    expect(pageSelectionState(new Set(["a", "b", "z"]), ["a", "b"])).toBe("all");
    expect(pageSelectionState(new Set(["a"]), [])).toBe("none");
  });
});

describe("togglePage", () => {
  test("selects the whole page unless it is already fully selected", () => {
    expect([...togglePage(new Set(["z"]), ["a", "b"])].sort()).toEqual(["a", "b", "z"]);
    expect([...togglePage(new Set(["a", "b", "z"]), ["a", "b"])]).toEqual(["z"]);
  });
});
