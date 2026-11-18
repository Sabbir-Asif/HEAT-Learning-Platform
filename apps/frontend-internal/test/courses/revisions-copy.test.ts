import { describe, expect, test } from "vitest";
import {
  revisionModuleCountLabel,
  revisionSnapshotNotice,
  revisionStudentsOverflow,
} from "../../src/courses/revisions-copy";

describe("revisionSnapshotNotice", () => {
  test("says how many students keep this content", () => {
    expect(revisionSnapshotNotice("PUBLISHED", 1)).toContain("1 student is enrolled");
    expect(revisionSnapshotNotice("PUBLISHED", 12)).toContain("12 students are enrolled");
  });

  test("explains an empty draft and an empty published revision", () => {
    expect(revisionSnapshotNotice("DRAFT", 0)).toContain("draft");
    expect(revisionSnapshotNotice("PUBLISHED", 0)).toContain("New approvals");
  });
});

describe("snapshot labels", () => {
  test("pluralises the module count", () => {
    expect(revisionModuleCountLabel(1)).toBe("1 module");
    expect(revisionModuleCountLabel(3)).toBe("3 modules");
  });

  test("states how many students are shown", () => {
    expect(revisionStudentsOverflow(100, 140)).toBe("Showing the first 100 of 140 students.");
  });
});
