export const resourceLeaveMessage = "You have unsaved changes. Leave this page and lose them?";

export const resourceSavedMessage = "The resource was saved.";

export const resourceDeleteFailedMessage = (title: string): string =>
  `${title} could not be deleted. Try again.`;

export const resourceDeletedMessage = (title: string): string => `${title} was deleted.`;

export const resourceUploadHelp =
  "PDF, Word (.docx) or PowerPoint (.pptx) file of up to 25 MB. Visitors can download it without signing in.";

export const resourceSaveFailedMessage = (code: string | undefined): string => {
  if (code === "VALIDATION_FAILED") {
    return "Check the highlighted fields. The file or the course may no longer be available.";
  }
  if (code === "RATE_LIMITED") return "Too many requests. Wait a moment and try again.";
  return "The resource could not be saved. Try again.";
};

export const resourceUploadFailedMessage = (code: string | undefined): string => {
  if (code === "UPLOAD_TYPE_NOT_ALLOWED") {
    return "This file type is not allowed. Upload a PDF, DOCX or PPTX file.";
  }
  if (code === "UPLOAD_TOO_LARGE") return "This file is larger than 25 MB.";
  if (code === "RATE_LIMITED") return "Too many uploads. Wait a moment and try again.";
  return "The upload failed. Try again.";
};
