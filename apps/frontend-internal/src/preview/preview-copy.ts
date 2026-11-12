import type { VideoSlotStatus } from "@heat/contracts";

export const previewNotice = "Preview only. Nothing you do here is recorded as progress.";

export const videoStatusMessage = (status: VideoSlotStatus): string => {
  if (status === "NOT_UPLOADED") return "No video has been uploaded for this slot yet.";
  if (status === "FAILED") return "Processing failed for this video.";
  if (status === "REJECTED") return "This video was rejected when it was uploaded.";
  return "This video is still processing. It will play here once it is ready.";
};
