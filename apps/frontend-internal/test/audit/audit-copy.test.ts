import { describe, expect, test } from "vitest";
import { actorLabel, describeChange } from "../../src/audit/audit-copy";

describe("describeChange", () => {
  test("lists only the fields that changed", () => {
    expect(describeChange({ status: "INVITED", same: 1 }, { status: "ACTIVE", same: 1 })).toBe(
      "status: INVITED to ACTIVE",
    );
  });

  test("shows new values when there was no before", () => {
    expect(describeChange(null, { status: "INVITED" })).toBe("status: INVITED");
  });

  test("is empty when nothing was recorded", () => {
    expect(describeChange(null, null)).toBe("");
  });
});

describe("actorLabel", () => {
  test("falls back to System or Removed account", () => {
    expect(actorLabel("a@example.test", "1")).toBe("a@example.test");
    expect(actorLabel(null, null)).toBe("System");
    expect(actorLabel(null, "1")).toBe("Removed account");
  });
});
