export const newsLeaveMessage = "You have unsaved changes. Leave this page and lose them?";

export const newsSavedMessage = "The post was saved.";

export const newsPublishDateHelp =
  "Asia/Dhaka time. Leave empty to publish when you save. A later time schedules the post.";

export const newsInvalidDateMessage = "Enter a valid date and time.";

export const newsDeleteFailedMessage = (title: string): string =>
  `${title} could not be deleted. Try again.`;

export const newsSaveFailedMessage = (code: string | undefined): string => {
  if (code === "VALIDATION_FAILED") {
    return "The text contains content that is not allowed, or an image is missing its description.";
  }
  if (code === "RATE_LIMITED") return "Too many requests. Wait a moment and try again.";
  return "The post could not be saved. Try again.";
};
