import { expect, test } from "vitest";
import { assertNotInUse, RecordInUseError } from "../src/in-use";

test("passes when every usage count is zero", () => {
  expect(() =>
    assertNotInUse([
      { name: "departments", count: 0 },
      { name: "profiles", count: 0 },
    ]),
  ).not.toThrow();
});

test("passes when there are no usages", () => {
  expect(() => assertNotInUse([])).not.toThrow();
});

test("throws listing only the usages that block", () => {
  try {
    assertNotInUse([
      { name: "departments", count: 2 },
      { name: "profiles", count: 0 },
      { name: "enrollments", count: 1 },
    ]);
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(RecordInUseError);
    expect((error as RecordInUseError).blockers).toEqual([
      { name: "departments", count: 2 },
      { name: "enrollments", count: 1 },
    ]);
    expect((error as RecordInUseError).message).toBe(
      "Record is in use by departments, enrollments",
    );
  }
});
