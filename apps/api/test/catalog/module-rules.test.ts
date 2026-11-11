import { describe, expect, test } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import {
  assertContentUnlocked,
  nextOrder,
  planReorder,
  planResequence,
} from "../../src/catalog/module-rules";

const failureOf = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
};

describe("assertContentUnlocked", () => {
  test("passes for an unlocked course", () => {
    expect(() => assertContentUnlocked(null)).not.toThrow();
  });

  test("refuses a locked course with CONTENT_LOCKED", () => {
    const error = failureOf(() => assertContentUnlocked(new Date()));
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getStatus()).toBe(409);
    expect((error as ApiException).code).toBe("CONTENT_LOCKED");
  });
});

describe("nextOrder", () => {
  test("starts at 1 and follows the highest order", () => {
    expect(nextOrder(null)).toBe(1);
    expect(nextOrder(4)).toBe(5);
  });
});

describe("planReorder", () => {
  const current = ["a", "b", "c"];

  test("moves the third item to the top and numbers the sequence 1, 2, 3", () => {
    const plan = planReorder(current, { previousIds: current, orderedIds: ["c", "a", "b"] });
    expect(plan.final).toEqual([
      { id: "c", order: 1 },
      { id: "a", order: 2 },
      { id: "b", order: 3 },
    ]);
  });

  test("parks every item on a distinct negative order so no duplicate exists at any step", () => {
    const plan = planReorder(current, { previousIds: current, orderedIds: ["c", "a", "b"] });
    const parked = plan.parking.map((step) => step.order);
    expect(new Set(parked).size).toBe(parked.length);
    expect(parked.every((order) => order < 0)).toBe(true);
    expect(plan.parking.map((step) => step.id).sort()).toEqual(["a", "b", "c"]);
  });

  test("answers ORDER_CONFLICT when the client saw a different order", () => {
    const error = failureOf(() =>
      planReorder(["b", "a", "c"], { previousIds: current, orderedIds: ["c", "a", "b"] }),
    );
    expect((error as ApiException).getStatus()).toBe(409);
    expect((error as ApiException).code).toBe("ORDER_CONFLICT");
  });

  test("answers ORDER_CONFLICT when an item was added or removed meanwhile", () => {
    const error = failureOf(() =>
      planReorder(["a", "b"], { previousIds: current, orderedIds: ["c", "b", "a"] }),
    );
    expect((error as ApiException).code).toBe("ORDER_CONFLICT");
  });

  test.each([
    ["a missing id", ["a", "b"]],
    ["an unknown id", ["a", "b", "x"]],
    ["a repeated id", ["a", "a", "b"]],
  ])("refuses %s as a validation failure", (_name, orderedIds) => {
    const error = failureOf(() => planReorder(current, { previousIds: current, orderedIds }));
    expect((error as ApiException).getStatus()).toBe(400);
    expect((error as ApiException).code).toBe("VALIDATION_FAILED");
  });
});

describe("planResequence", () => {
  test("closes the gap left by a removed item", () => {
    const plan = planResequence(["a", "c"]);
    expect(plan.final).toEqual([
      { id: "a", order: 1 },
      { id: "c", order: 2 },
    ]);
    expect(plan.parking.map((step) => step.order)).toEqual([-1, -2]);
  });

  test("plans nothing for an empty list", () => {
    expect(planResequence([])).toEqual({ parking: [], final: [] });
  });
});
