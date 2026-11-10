export const universityNameTakenMessage = "A university with this name already exists.";

export const unsavedChangesMessage = "You have unsaved changes. Discard them?";

interface Usage {
  studentCount: number;
  departmentCount: number;
  facultyCount: number;
}

const plural = (count: number, singular: string, many: string): string =>
  `${count} ${count === 1 ? singular : many}`;

export const usagePhrase = (usage: Usage): string => {
  const parts = [
    usage.studentCount > 0 ? plural(usage.studentCount, "student", "students") : null,
    usage.departmentCount > 0 ? plural(usage.departmentCount, "department", "departments") : null,
    usage.facultyCount > 0 ? plural(usage.facultyCount, "faculty link", "faculty links") : null,
  ].filter((part): part is string => part !== null);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
};

export const deleteBlockedMessage = (name: string, usage: Usage): string => {
  const phrase = usagePhrase(usage);
  return phrase === ""
    ? `${name} is still in use, so it cannot be deleted. Archive it instead.`
    : `${name} is used by ${phrase}, so it cannot be deleted. Archive it instead.`;
};
