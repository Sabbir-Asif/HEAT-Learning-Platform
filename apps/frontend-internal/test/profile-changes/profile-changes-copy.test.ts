import { ApiError } from "@heat/api-client";
import { describe, expect, test } from "vitest";
import {
  changeLines,
  decisionFailureMessage,
  statusParam,
  toStatusFilter,
} from "../../src/profile-changes/profile-changes-copy";
import type { ProfileChangeRow } from "../../src/profile-changes/profile-changes-copy";

const named = (name: string) => ({ id: "0198f1a0-0000-7000-8000-0000000000a1", name });

const row = (requested: Partial<ProfileChangeRow["requested"]>): ProfileChangeRow => ({
  id: "0198f1a0-0000-7000-8000-000000000001",
  status: "PENDING",
  requested: {
    name: null,
    university: null,
    faculty: null,
    department: null,
    session: null,
    ...requested,
  },
  note: null,
  reason: null,
  createdAt: "2026-11-17T04:00:00.000Z",
  decidedAt: null,
  student: { name: "Anne Smith", email: "anne@example.test" },
  current: {
    name: "Anne Smith",
    university: named("University of Dhaka"),
    faculty: named("Science"),
    department: named("Physics"),
    session: "2020-21",
  },
});

describe("changeLines", () => {
  test("shows current and requested values for each changed field only", () => {
    expect(changeLines(row({ name: "Anne Jones", session: "2021-22" }))).toEqual([
      "Name: Anne Smith to Anne Jones",
      "Session: 2020-21 to 2021-22",
    ]);
  });

  test("covers the academic details", () => {
    expect(
      changeLines(
        row({
          university: named("Other University"),
          faculty: named("Arts"),
          department: named("History"),
        }),
      ),
    ).toEqual([
      "University: University of Dhaka to Other University",
      "Faculty: Science to Arts",
      "Department: Physics to History",
    ]);
  });
});

describe("status filter", () => {
  test("defaults to pending for anything unknown", () => {
    expect(toStatusFilter("")).toBe("pending");
    expect(toStatusFilter("other")).toBe("pending");
    expect(toStatusFilter("rejected")).toBe("rejected");
  });

  test("maps to the API status", () => {
    expect(statusParam("pending")).toBe("PENDING");
    expect(statusParam("approved")).toBe("APPROVED");
    expect(statusParam("rejected")).toBe("REJECTED");
  });
});

describe("decisionFailureMessage", () => {
  test("explains an archived department from the field error", () => {
    const error = new ApiError({
      status: 400,
      code: "VALIDATION_FAILED",
      fields: [{ path: "departmentId", code: "invalid_value" }],
    });
    expect(decisionFailureMessage(error)).toContain("archived");
  });

  test("explains a non-English name from the field error", () => {
    const error = new ApiError({
      status: 400,
      code: "VALIDATION_FAILED",
      fields: [{ path: "name", code: "invalid_format" }],
    });
    expect(decisionFailureMessage(error)).toContain("English");
  });

  test("uses the catalog text for a decided request", () => {
    const error = new ApiError({ status: 409, code: "PROFILE_CHANGE_NOT_PENDING" });
    expect(decisionFailureMessage(error)).toContain("already decided");
  });

  test("falls back to the generic server text for unknown failures", () => {
    expect(decisionFailureMessage(new Error("boom"))).toContain("Something went wrong");
  });
});
