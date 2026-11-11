import { describe, expect, test } from "vitest";
import {
  createModuleRequestSchema,
  lessonSectionRequestSchema,
  moduleFormSchema,
  reorderRequestSchema,
} from "../src/index";

const a = "0198f1a0-0000-7000-8000-0000000000a1";
const b = "0198f1a0-0000-7000-8000-0000000000a2";

describe("createModuleRequestSchema", () => {
  test("defaults objectives to an empty list and normalises the title", () => {
    expect(createModuleRequestSchema.parse({ title: "  Consent   basics " })).toEqual({
      title: "Consent basics",
      objectives: [],
    });
  });

  test("trims objectives and rejects a blank one", () => {
    expect(
      createModuleRequestSchema.parse({ title: "A", objectives: ["  Spot  signs "] }).objectives,
    ).toEqual(["Spot signs"]);
    expect(createModuleRequestSchema.safeParse({ title: "A", objectives: ["  "] }).success).toBe(
      false,
    );
  });

  test("rejects more than ten objectives and an overlong one", () => {
    const eleven = Array.from({ length: 11 }, (_, index) => `Objective ${index}`);
    expect(createModuleRequestSchema.safeParse({ title: "A", objectives: eleven }).success).toBe(
      false,
    );
    expect(
      createModuleRequestSchema.safeParse({ title: "A", objectives: ["x".repeat(201)] }).success,
    ).toBe(false);
  });

  test("rejects a missing title", () => {
    expect(createModuleRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("moduleFormSchema", () => {
  test("accepts rows of objective text", () => {
    expect(moduleFormSchema.safeParse({ title: "A", objectives: [{ text: "Know" }] }).success).toBe(
      true,
    );
  });
});

describe("lessonSectionRequestSchema", () => {
  test("requires a title", () => {
    expect(lessonSectionRequestSchema.safeParse({ title: " " }).success).toBe(false);
    expect(lessonSectionRequestSchema.parse({ title: "Intro" })).toEqual({ title: "Intro" });
  });
});

describe("reorderRequestSchema", () => {
  test("accepts two id lists", () => {
    expect(reorderRequestSchema.safeParse({ previousIds: [a, b], orderedIds: [b, a] }).success).toBe(
      true,
    );
  });

  test("rejects a repeated id and a non-uuid", () => {
    expect(reorderRequestSchema.safeParse({ previousIds: [a], orderedIds: [a, a] }).success).toBe(
      false,
    );
    expect(reorderRequestSchema.safeParse({ previousIds: [a], orderedIds: ["x"] }).success).toBe(
      false,
    );
  });
});
