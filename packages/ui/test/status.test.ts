import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { resolveStatus, statusEntries } from "../src/composites/status";

const tokens = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../../docs/design/tokens.json"), "utf8"),
) as { statusTones: Record<string, string> };

describe("status mapping", () => {
  test("covers exactly the states in tokens.json with the same tone", () => {
    const mapped = Object.fromEntries(
      Object.entries(statusEntries).map(([key, entry]) => [key, entry.tone]),
    );
    expect(mapped).toEqual(tokens.statusTones);
  });

  test.each(Object.entries(statusEntries))("%s has a label and an icon", (_key, entry) => {
    expect(entry.label.length).toBeGreaterThan(0);
    expect(entry.icon).toBeTruthy();
  });

  test("resolves contract enum names to the kebab-case entries", () => {
    expect(resolveStatus("enrollment", "PENDING_VERIFICATION")).toBe(
      statusEntries["enrollment.pending-verification"],
    );
    expect(resolveStatus("video", "ready")).toBe(statusEntries["video.ready"]);
    expect(resolveStatus("course", "LOCKED")).toBe(statusEntries["course.locked"]);
  });

  test("falls back to a neutral entry that shows the raw value", () => {
    const entry = resolveStatus("enrollment", "SOMETHING_NEW");
    expect(entry.tone).toBe("neutral");
    expect(entry.label).toBe("SOMETHING_NEW");
  });
});
