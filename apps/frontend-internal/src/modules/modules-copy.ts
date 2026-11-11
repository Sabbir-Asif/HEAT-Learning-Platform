import type { ModuleFormValues } from "@heat/contracts";

export const moduleLockedMessage =
  "This course is locked. Modules and sections cannot be added, removed or reordered. Wording changes to titles and objectives are logged.";

export const unsavedChangesMessage = "You have unsaved changes. Discard them?";

export const moduleDeleteFailedMessage = (title: string): string =>
  `${title} could not be deleted. Try again.`;

export const sectionDeleteFailedMessage = (title: string): string =>
  `${title} could not be removed. Try again.`;

export const videoSlotDeleteFailedMessage = (title: string): string =>
  `${title} could not be removed. Try again.`;

export const videoSlotLockedMessage =
  "This course is locked. Video slots cannot be added, removed, reordered or switched between required and optional.";

export const videoUploadFailedMessage = (code: string | undefined): string => {
  if (code === "CONTENT_LOCKED") return "This course is locked, so videos cannot be uploaded.";
  if (code === "UPLOAD_TOO_LARGE") return "This file is larger than the upload limit.";
  if (code === "UPLOAD_TYPE_NOT_ALLOWED") {
    return "This file is not a supported video. Use MP4, MOV, WebM or MKV.";
  }
  if (code === "UPLOAD_EXPIRED")
    return "This upload expired before it finished. Choose the file again.";
  if (code === "RATE_LIMITED") return "Too many upload requests. Wait a moment and retry.";
  if (code === "NETWORK_ERROR") {
    return "The connection dropped. Retry to continue from where it stopped.";
  }
  return "The upload failed. Try again.";
};

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
