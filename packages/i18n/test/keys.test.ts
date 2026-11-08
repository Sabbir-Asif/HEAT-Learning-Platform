import { describe, expect, test } from "vitest";
import { compareKeys, flattenKeys } from "../src/keys";

describe("flattenKeys", () => {
  test("lists dotted paths of every string leaf, sorted", () => {
    expect(flattenKeys({ b: { y: "1", x: "2" }, a: "3" })).toEqual({
      a: "3",
      "b.x": "2",
      "b.y": "1",
    });
  });
});

describe("compareKeys", () => {
  test("reports nothing when the key sets match", () => {
    expect(compareKeys({ a: { b: "x" } }, { a: { b: "y" } })).toEqual({ missing: [], extra: [] });
  });

  test("names a key missing from the candidate and one it adds", () => {
    expect(compareKeys({ a: { b: "x", c: "y" } }, { a: { b: "x" }, d: "z" })).toEqual({
      missing: ["a.c"],
      extra: ["d"],
    });
  });
});
