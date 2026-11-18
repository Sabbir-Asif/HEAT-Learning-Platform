export const courseSlugTakenMessage = "A course with this slug already exists.";

export const courseLockedMessage =
  "This revision is published and locked. The title and slug cannot change; the description can. Clone it into a draft to change them.";

export const unsavedChangesMessage = "You have unsaved changes. Discard them?";

export const courseDeleteBlockedMessage = (title: string, enrollmentCount: number): string =>
  `${title} has ${enrollmentCount} ${enrollmentCount === 1 ? "enrollment" : "enrollments"}, so it cannot be deleted.`;

export const courseDeleteFailedMessage = (title: string): string =>
  `${title} could not be deleted. Try again.`;

export const publishFailedMessage = (title: string, failures: readonly string[]): string =>
  failures.length === 0
    ? `${title} could not be published. Try again.`
    : `${title} is not ready to publish. ${failures.join(" ")}`;

export const publishBlockersTitle = (count: number): string =>
  count === 1 ? "1 thing blocks publishing" : `${count} things block publishing`;

export const publishChecklistClearMessage = "Every module has a ready video and a complete quiz.";

export const publishChecklistFailedMessage = "The publish checklist could not be loaded.";
