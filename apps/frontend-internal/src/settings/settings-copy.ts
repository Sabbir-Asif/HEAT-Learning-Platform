export const quizSettingsSavedMessage = "The quiz settings were saved.";

export const quizSettingsFailedMessage = (code: string | undefined): string => {
  if (code === "VALIDATION_FAILED") return "The attempt limit is not valid. Check the field.";
  if (code === "RATE_LIMITED") return "Too many requests. Wait a moment and try again.";
  return "The quiz settings could not be saved. Try again.";
};
