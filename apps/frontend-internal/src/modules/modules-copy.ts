import type { ModuleFormValues } from "@heat/contracts";

export const moduleLockedMessage =
  "This course is locked. Modules and sections cannot be added, removed or reordered. Wording changes to titles and objectives are logged.";

export const unsavedChangesMessage = "You have unsaved changes. Discard them?";

export const moduleDeleteFailedMessage = (title: string): string =>
  `${title} could not be deleted. Try again.`;

export const sectionDeleteFailedMessage = (title: string): string =>
  `${title} could not be removed. Try again.`;

export const reorderFailedMessage = (code: string | undefined): string => {
  if (code === "ORDER_CONFLICT") {
    return "Someone else changed this order. Reload the list and try again.";
  }
  if (code === "CONTENT_LOCKED") {
    return "This course is locked, so the order cannot change.";
  }
  return "The order could not be saved. Try again.";
};

export const moduleFormValuesOf = (
  module: { title: string; objectives: readonly string[] } | null,
): ModuleFormValues => ({
  title: module?.title ?? "",
  objectives: (module?.objectives ?? []).map((text) => ({ text })),
});

export const moduleRequestOf = (
  values: ModuleFormValues,
): { title: string; objectives: string[] } => ({
  title: values.title,
  objectives: values.objectives.map((row) => row.text),
});
