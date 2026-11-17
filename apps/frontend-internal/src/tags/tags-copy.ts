export const tagNameTakenMessage = "A tag with this name already exists.";

export const unsavedChangesMessage = "You have unsaved changes. Discard them?";

export const frontPageHiddenNote = "Not published, so visitors do not see it yet.";

const plural = (count: number, singular: string, many: string): string =>
  `${count} ${count === 1 ? singular : many}`;

const joinPhrases = (parts: readonly string[]): string =>
  parts.length <= 1
    ? (parts[0] ?? "")
    : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

export const tagUsagePhrase = (usage: {
  courses: readonly unknown[];
  modules: readonly unknown[];
}): string =>
  joinPhrases(
    [
      usage.courses.length > 0 ? plural(usage.courses.length, "course", "courses") : null,
      usage.modules.length > 0 ? plural(usage.modules.length, "module", "modules") : null,
    ].filter((part): part is string => part !== null),
  );

export const tagDeleteDescription = (usage: {
  courses: ReadonlyArray<{ title: string }>;
  modules: ReadonlyArray<{ title: string; courseTitle: string }>;
}): string => {
  const phrase = tagUsagePhrase(usage);
  if (phrase === "") return "No course or module uses this tag.";
  const names = [
    ...usage.courses.map((course) => course.title),
    ...usage.modules.map((module) => `${module.title} (${module.courseTitle})`),
  ];
  return `It is used by ${phrase}: ${names.join(", ")}. They stay as they are, and only the tag is removed from them.`;
};

export const tagDeleteFailedMessage = (name: string): string =>
  `${name} could not be deleted. Try again.`;

export const frontPageReorderFailedMessage = (code: string | undefined): string => {
  if (code === "ORDER_CONFLICT") {
    return "Someone else changed this order. Reload the list and try again.";
  }
  return "The order could not be saved. Try again.";
};

export const tagsSaveFailedMessage = "The tags could not be saved. Try again.";
