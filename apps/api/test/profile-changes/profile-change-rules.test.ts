import { describe, expect, test } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import {
  assertSomethingChanges,
  assertStoredNameIsEnglish,
  departmentIsChanging,
  isUniqueViolation,
  pairIsChanging,
  requestedChanges,
} from "../../src/profile-changes/profile-change-rules";

const current = {
  name: "Anne Smith",
  session: "2020-21",
  department: {
    id: "department-id",
    universityFaculty: { universityId: "university-id", facultyId: "faculty-id" },
  },
};

const same = {
  name: "Anne Smith",
  universityId: "university-id",
  facultyId: "faculty-id",
  departmentId: "department-id",
  session: "2020-21",
};

describe("requestedChanges", () => {
  test("is empty when nothing differs", () => {
    expect(requestedChanges(current, same)).toEqual({});
  });

  test("keeps only the fields that differ", () => {
    expect(requestedChanges(current, { ...same, name: "Anne Jones", session: "2021-22" })).toEqual({
      name: "Anne Jones",
      session: "2021-22",
    });
  });

  test("includes the department when it differs", () => {
    expect(requestedChanges(current, { ...same, departmentId: "other" })).toEqual({
      departmentId: "other",
    });
  });
});

describe("assertSomethingChanges", () => {
  test("refuses an empty request with the unchanged code", () => {
    expect(() => assertSomethingChanges({})).toThrow(
      expect.objectContaining({ code: "PROFILE_CHANGE_UNCHANGED" }),
    );
  });

  test("accepts one changed field", () => {
    expect(() => assertSomethingChanges({ session: "2021-22" })).not.toThrow();
  });
});

describe("departmentIsChanging and pairIsChanging", () => {
  test("detect a different department", () => {
    expect(departmentIsChanging(current, { departmentId: "other" })).toBe(true);
    expect(departmentIsChanging(current, same)).toBe(false);
  });

  test("detect a different university or faculty", () => {
    expect(pairIsChanging(current, { ...same, universityId: "other" })).toBe(true);
    expect(pairIsChanging(current, { ...same, facultyId: "other" })).toBe(true);
    expect(pairIsChanging(current, same)).toBe(false);
  });
});

describe("assertStoredNameIsEnglish", () => {
  test("accepts a Latin name", () => {
    expect(() => assertStoredNameIsEnglish("Anne O'Neil")).not.toThrow();
  });

  test("refuses a non-Latin name with a name field error", () => {
    try {
      assertStoredNameIsEnglish("আমিনা");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).fields).toEqual([{ path: "name", code: "invalid_format" }]);
    }
  });
});

describe("isUniqueViolation", () => {
  test("recognises the unique constraint code only", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation({ code: "P2025" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
