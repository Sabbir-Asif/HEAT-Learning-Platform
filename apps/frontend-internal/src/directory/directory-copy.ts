export const facultyNameTakenMessage = "A faculty with this name already exists.";

export const departmentNameTakenMessage =
  "A department with this name already exists for this university and faculty.";

export const departmentMoveBlockedMessage =
  "This department has students, so it cannot be moved to another university or faculty.";

export const universityNameTakenMessage = "A university with this name already exists.";

export const unsavedChangesMessage = "You have unsaved changes. Discard them?";

interface Usage {
  studentCount: number;
  departmentCount: number;
  facultyCount: number;
}

const plural = (count: number, singular: string, many: string): string =>
  `${count} ${count === 1 ? singular : many}`;

const joinPhrases = (parts: readonly string[]): string =>
  parts.length <= 1
    ? (parts[0] ?? "")
    : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

export const usagePhrase = (usage: Usage): string =>
  joinPhrases(
    [
      usage.studentCount > 0 ? plural(usage.studentCount, "student", "students") : null,
      usage.departmentCount > 0 ? plural(usage.departmentCount, "department", "departments") : null,
      usage.facultyCount > 0 ? plural(usage.facultyCount, "faculty link", "faculty links") : null,
    ].filter((part): part is string => part !== null),
  );

export const deleteBlockedMessage = (name: string, usage: Usage): string => {
  const phrase = usagePhrase(usage);
  return phrase === ""
    ? `${name} is still in use, so it cannot be deleted. Archive it instead.`
    : `${name} is used by ${phrase}, so it cannot be deleted. Archive it instead.`;
};

interface FacultyUsage {
  studentCount: number;
  departmentCount: number;
  universityCount: number;
}

export const facultyUsagePhrase = (usage: FacultyUsage): string =>
  joinPhrases(
    [
      usage.studentCount > 0 ? plural(usage.studentCount, "student", "students") : null,
      usage.departmentCount > 0 ? plural(usage.departmentCount, "department", "departments") : null,
      usage.universityCount > 0
        ? plural(usage.universityCount, "university link", "university links")
        : null,
    ].filter((part): part is string => part !== null),
  );

export const facultyDeleteBlockedMessage = (name: string, usage: FacultyUsage): string => {
  const phrase = facultyUsagePhrase(usage);
  return phrase === ""
    ? `${name} is still in use, so it cannot be deleted. Archive it instead.`
    : `${name} is used by ${phrase}, so it cannot be deleted. Archive it instead.`;
};

export const linkProblemMessage = (
  name: string,
  problems: { blocked: readonly string[]; failed: readonly string[] },
): string =>
  [
    `${name} was saved.`,
    problems.blocked.length > 0
      ? `It still has departments at ${joinPhrases(problems.blocked)}, so it was not removed from there.`
      : null,
    problems.failed.length > 0
      ? `Its link with ${joinPhrases(problems.failed)} could not be saved. Try again.`
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" ");

export const optionsTruncatedMessage = (limit: number): string =>
  `Only the first ${limit} names are listed. Search is not available here yet.`;
