import type { ModuleFormValues, VideoRejectionReason } from "@heat/contracts";

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

export const videoRejectionMessage = (reason: VideoRejectionReason): string => {
  if (reason === "NOT_A_VIDEO") return "The file was rejected: it is not a video.";
  if (reason === "UNSUPPORTED_CONTAINER") {
    return "The file was rejected: its format is not supported. Use MP4, MOV, WebM or MKV.";
  }
  if (reason === "UNSUPPORTED_CODEC") {
    return "The file was rejected: its video codec is not supported. Use H.264, H.265, VP8, VP9 or AV1.";
  }
  if (reason === "TOO_LARGE") return "The file was rejected: it is over the size limit.";
  return "The file was rejected: it is incomplete or has no duration.";
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

export const sectionBodyFailedMessage = (code: string | undefined): string => {
  if (code === "CONTENT_LOCKED") {
    return "This course is locked, so only wording can change. Images, links and headings must stay as they are.";
  }
  if (code === "VALIDATION_FAILED") return "The text contains content that is not allowed.";
  return "The text could not be saved. Try again.";
};

export const captionUploadFailedMessage = (code: string | undefined): string => {
  if (code === "UPLOAD_TOO_LARGE") return "This caption file is larger than 1 MB.";
  if (code === "UPLOAD_TYPE_NOT_ALLOWED") {
    return "This is not a WebVTT caption file. It must be UTF-8 text that starts with WEBVTT.";
  }
  if (code === "VIDEO_NOT_READY")
    return "The video must finish processing before it can have captions.";
  if (code === "RATE_LIMITED") return "Too many uploads. Wait a moment and retry.";
  if (code === "NETWORK_ERROR") return "The connection dropped. Retry the upload.";
  return "The caption could not be uploaded. Try again.";
};

export const captionRemoveFailedMessage = "The caption could not be removed. Try again.";
