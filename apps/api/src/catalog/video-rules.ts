import type { VideoSlotStatus } from "@heat/contracts";
import { assertContentUnlocked } from "./module-rules";

export const slotStatusOf = (asset: { status: VideoSlotStatus } | null): VideoSlotStatus =>
  asset === null ? "NOT_UPLOADED" : asset.status;

export const assertRequiredFlagUnlocked = (
  lockedAt: Date | null,
  current: boolean,
  next: boolean,
): void => {
  if (current !== next) assertContentUnlocked(lockedAt);
};
