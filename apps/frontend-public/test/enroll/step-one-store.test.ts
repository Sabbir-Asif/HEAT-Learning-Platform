import { afterEach, describe, expect, test, vi } from "vitest";
import {
  clearStepOne,
  emptyStepOne,
  readStepOne,
  stepOneStorageKey,
  writeStepOne,
} from "../../src/enroll/step-one-store";

const values = {
  name: "Anne Smith",
  universityId: "u1",
  facultyId: "f1",
  departmentId: "d1",
  session: "2020-21",
};

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("step one store", () => {
  test("returns an empty form when nothing is stored", () => {
    expect(readStepOne()).toEqual(emptyStepOne);
  });

  test("restores what was written", () => {
    writeStepOne(values);
    expect(readStepOne()).toEqual(values);
  });

  test("stores only the step one fields", () => {
    writeStepOne({ ...values, password: "secret" } as typeof values);
    expect(
      Object.keys(JSON.parse(sessionStorage.getItem(stepOneStorageKey) ?? "{}")).sort(),
    ).toEqual(["departmentId", "facultyId", "name", "session", "universityId"]);
  });

  test.each(["{not json", "[]", "null", '"text"', '{"name":5}'])(
    "falls back to an empty form for corrupt data %s",
    (raw) => {
      sessionStorage.setItem(stepOneStorageKey, raw);
      expect(readStepOne()).toEqual(emptyStepOne);
    },
  );

  test("keeps valid string fields and blanks the rest", () => {
    sessionStorage.setItem(stepOneStorageKey, JSON.stringify({ name: "Anne", session: 5 }));
    expect(readStepOne()).toEqual({ ...emptyStepOne, name: "Anne" });
  });

  test("clear removes the stored values", () => {
    writeStepOne(values);
    clearStepOne();
    expect(readStepOne()).toEqual(emptyStepOne);
  });

  test("works without session storage", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readStepOne()).toEqual(emptyStepOne);
    expect(() => writeStepOne(values)).not.toThrow();
    expect(() => clearStepOne()).not.toThrow();
  });
});
