import { expect, test } from "vitest";
import { cn } from "../src/lib/utils";

test("joins class names and skips falsy values", () => {
  expect(cn("p-4", false, undefined, "text-body")).toBe("p-4 text-body");
});

test("lets the later of two conflicting utilities win", () => {
  expect(cn("p-2 bg-primary", "p-4")).toBe("bg-primary p-4");
});

test("accepts conditional objects", () => {
  expect(cn("rounded-md", { "bg-muted": true, "bg-card": false })).toBe("rounded-md bg-muted");
});
