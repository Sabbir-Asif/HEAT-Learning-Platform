export const contactSettingsSavedMessage = "The contact details were saved.";

export const contactSettingsFailedMessage = (code: string | undefined): string => {
  if (code === "VALIDATION_FAILED") return "Some contact details are not valid. Check the fields.";
  if (code === "RATE_LIMITED") return "Too many requests. Wait a moment and try again.";
  return "The contact details could not be saved. Try again.";
};
