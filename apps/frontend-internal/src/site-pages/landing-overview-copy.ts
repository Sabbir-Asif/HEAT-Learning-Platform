export const landingOverviewSavedMessage = "The overview was saved.";

export const landingOverviewLeaveMessage =
  "You have unsaved changes. Leave this page and lose them?";

export const landingOverviewFailedMessage = (code: string | undefined): string => {
  if (code === "VALIDATION_FAILED") return "The text contains content that is not allowed.";
  if (code === "RATE_LIMITED") return "Too many requests. Wait a moment and try again.";
  return "The overview could not be saved. Try again.";
};
