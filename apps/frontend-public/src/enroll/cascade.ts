import type { StepOneValues } from "./step-one-store";

interface Option {
  id: string;
}

export interface LoadedLists {
  universities?: readonly Option[];
  faculties?: readonly Option[];
  departments?: readonly Option[];
}

export function chooseUniversity(values: StepOneValues, universityId: string): StepOneValues {
  if (values.universityId === universityId) return values;
  return { ...values, universityId, facultyId: "", departmentId: "" };
}

export function chooseFaculty(values: StepOneValues, facultyId: string): StepOneValues {
  if (values.facultyId === facultyId) return values;
  return { ...values, facultyId, departmentId: "" };
}

const missing = (list: readonly Option[] | undefined, id: string): boolean =>
  id !== "" && list !== undefined && !list.some((option) => option.id === id);

export function dropStaleSelections(values: StepOneValues, lists: LoadedLists): StepOneValues {
  if (missing(lists.universities, values.universityId)) {
    return { ...values, universityId: "", facultyId: "", departmentId: "" };
  }
  if (missing(lists.faculties, values.facultyId)) {
    return { ...values, facultyId: "", departmentId: "" };
  }
  if (missing(lists.departments, values.departmentId)) return { ...values, departmentId: "" };
  return values;
}
