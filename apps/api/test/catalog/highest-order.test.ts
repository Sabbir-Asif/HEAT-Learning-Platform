import { describe, expect, test } from "vitest";
import {
  highestLessonSectionOrder,
  highestModuleOrder,
  highestVideoOrder,
} from "../../src/catalog/highest-order";
import type { OrderQueryClient } from "../../src/catalog/highest-order";

const clientReturning = (rows: { highest: number | null }[]): OrderQueryClient => ({
  $queryRaw: () => Promise.resolve(rows),
});

describe("highest order lookups", () => {
  test.each([
    ["video", highestVideoOrder],
    ["module", highestModuleOrder],
    ["lesson section", highestLessonSectionOrder],
  ])("returns the highest %s order including deleted rows", async (_name, lookup) => {
    expect(await lookup(clientReturning([{ highest: 4 }]), "parent-id")).toBe(4);
  });

  test.each([
    ["video", highestVideoOrder],
    ["module", highestModuleOrder],
    ["lesson section", highestLessonSectionOrder],
  ])("returns null for a %s parent with no rows", async (_name, lookup) => {
    expect(await lookup(clientReturning([{ highest: null }]), "parent-id")).toBeNull();
    expect(await lookup(clientReturning([]), "parent-id")).toBeNull();
  });
});
