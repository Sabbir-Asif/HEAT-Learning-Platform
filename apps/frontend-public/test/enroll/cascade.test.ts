import { describe, expect, test } from "vitest";
import { chooseFaculty, chooseUniversity, dropStaleSelections } from "../../src/enroll/cascade";

const values = {
  name: "Anne Smith",
  universityId: "u1",
  facultyId: "f1",
  departmentId: "d1",
  session: "2020-21",
};

const options = (...ids: string[]) => ids.map((id) => ({ id, name: id }));

describe("chooseUniversity", () => {
  test("clears faculty and department when the university changes", () => {
    expect(chooseUniversity(values, "u2")).toEqual({
      ...values,
      universityId: "u2",
      facultyId: "",
      departmentId: "",
    });
  });

  test("keeps the choices when the same university is picked again", () => {
    expect(chooseUniversity(values, "u1")).toEqual(values);
  });
});

describe("chooseFaculty", () => {
  test("clears the department when the faculty changes", () => {
    expect(chooseFaculty(values, "f2")).toEqual({ ...values, facultyId: "f2", departmentId: "" });
  });

  test("keeps the department when the same faculty is picked again", () => {
    expect(chooseFaculty(values, "f1")).toEqual(values);
  });
});

describe("dropStaleSelections", () => {
  test("keeps values that are in the loaded lists", () => {
    expect(
      dropStaleSelections(values, {
        universities: options("u1"),
        faculties: options("f1"),
        departments: options("d1"),
      }),
    ).toEqual(values);
  });

  test("clears a university missing from its list and everything below it", () => {
    expect(dropStaleSelections(values, { universities: options("u9") })).toEqual({
      ...values,
      universityId: "",
      facultyId: "",
      departmentId: "",
    });
  });

  test("clears a faculty missing from its list and the department below it", () => {
    expect(
      dropStaleSelections(values, { universities: options("u1"), faculties: options("f9") }),
    ).toEqual({ ...values, facultyId: "", departmentId: "" });
  });

  test("clears a department missing from its list", () => {
    expect(
      dropStaleSelections(values, {
        universities: options("u1"),
        faculties: options("f1"),
        departments: options("d9"),
      }),
    ).toEqual({ ...values, departmentId: "" });
  });

  test("leaves values alone while a list has not loaded", () => {
    expect(dropStaleSelections(values, {})).toEqual(values);
  });
});
