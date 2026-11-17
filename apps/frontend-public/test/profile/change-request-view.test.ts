import { describe, expect, test } from "vitest";
import { changeRequestState, requestedLines } from "../../src/profile/change-request-view";

const named = (name: string) => ({ id: "0198f1a0-0000-7000-8000-0000000000a1", name });

describe("changeRequestState", () => {
  test("is none without a request", () => {
    expect(changeRequestState(null)).toBe("none");
  });

  test("keeps pending and rejected apart", () => {
    expect(changeRequestState({ status: "PENDING" })).toBe("pending");
    expect(changeRequestState({ status: "REJECTED" })).toBe("rejected");
  });

  test("treats an approved request as settled", () => {
    expect(changeRequestState({ status: "APPROVED" })).toBe("none");
  });
});

describe("requestedLines", () => {
  test("lists only the fields that were asked to change", () => {
    expect(
      requestedLines({
        name: "Anne Jones",
        university: null,
        faculty: null,
        department: null,
        session: "2021-22",
      }),
    ).toEqual(["Name: Anne Jones", "Session: 2021-22"]);
  });

  test("lists the academic details in order", () => {
    expect(
      requestedLines({
        name: null,
        university: named("University of Dhaka"),
        faculty: named("Science"),
        department: named("Chemistry"),
        session: null,
      }),
    ).toEqual(["University: University of Dhaka", "Faculty: Science", "Department: Chemistry"]);
  });
});
