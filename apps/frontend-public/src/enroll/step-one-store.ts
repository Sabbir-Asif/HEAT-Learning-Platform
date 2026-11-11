export const stepOneStorageKey = "heat.enroll.step-one";

export interface StepOneValues {
  name: string;
  universityId: string;
  facultyId: string;
  departmentId: string;
  session: string;
}

export const emptyStepOne: StepOneValues = {
  name: "",
  universityId: "",
  facultyId: "",
  departmentId: "",
  session: "",
};

const fields = Object.keys(emptyStepOne) as (keyof StepOneValues)[];

function pick(source: Record<string, unknown>): StepOneValues {
  const values = { ...emptyStepOne };
  for (const field of fields) {
    const value = source[field];
    if (typeof value === "string") values[field] = value;
  }
  return values;
}

export function readStepOne(): StepOneValues {
  try {
    const raw = sessionStorage.getItem(stepOneStorageKey);
    if (!raw) return { ...emptyStepOne };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ...emptyStepOne };
    }
    return pick(parsed as Record<string, unknown>);
  } catch {
    return { ...emptyStepOne };
  }
}

export function writeStepOne(values: StepOneValues): void {
  try {
    sessionStorage.setItem(stepOneStorageKey, JSON.stringify(pick({ ...values })));
  } catch {
    return;
  }
}

export function clearStepOne(): void {
  try {
    sessionStorage.removeItem(stepOneStorageKey);
  } catch {
    return;
  }
}
