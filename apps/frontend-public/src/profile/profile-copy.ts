export const avatarUploadFailedMessage = (code: string | undefined): string => {
  if (code === "UPLOAD_TYPE_NOT_ALLOWED") return "Use a JPG, PNG or WebP picture.";
  if (code === "UPLOAD_TOO_LARGE") return "The picture is too large. Use one up to 5 MB.";
  if (code === "UPLOAD_DIMENSIONS_TOO_LARGE") return "The picture has too many pixels.";
  if (code === "RATE_LIMITED") return "Too many uploads. Wait a moment and try again.";
  return "The picture could not be uploaded. Try again.";
};

export const lockedExplanation =
  "Your name and academic details are locked because your enrollment was approved. The name is printed on your certificate.";

export const requestChangeLabel = "Request a change";
