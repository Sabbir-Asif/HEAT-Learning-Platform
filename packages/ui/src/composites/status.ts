import type { LucideIcon } from "lucide-react";
import {
  BanIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  ClockIcon,
  FileEditIcon,
  GlobeIcon,
  HourglassIcon,
  LoaderIcon,
  LockIcon,
  MailCheckIcon,
  TimerOffIcon,
  TrophyIcon,
  UploadCloudIcon,
  UserMinusIcon,
  XCircleIcon,
} from "lucide-react";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

export type StatusKind = "enrollment" | "video" | "course";

export type StatusEntry = {
  label: string;
  icon: LucideIcon;
  tone: StatusTone;
};

export const statusEntries = {
  "enrollment.pending-verification": {
    label: "Pending verification",
    icon: MailCheckIcon,
    tone: "info",
  },
  "enrollment.pending-approval": {
    label: "Pending approval",
    icon: HourglassIcon,
    tone: "warning",
  },
  "enrollment.approved": { label: "Approved", icon: CheckCircle2Icon, tone: "success" },
  "enrollment.completed": { label: "Completed", icon: TrophyIcon, tone: "brand" },
  "enrollment.rejected": { label: "Rejected", icon: XCircleIcon, tone: "danger" },
  "enrollment.expired": { label: "Expired", icon: TimerOffIcon, tone: "neutral" },
  "enrollment.removed": { label: "Removed", icon: UserMinusIcon, tone: "danger" },
  "video.uploading": { label: "Uploading", icon: UploadCloudIcon, tone: "info" },
  "video.uploaded": { label: "Uploaded", icon: UploadCloudIcon, tone: "info" },
  "video.queued": { label: "Queued", icon: ClockIcon, tone: "neutral" },
  "video.processing": { label: "Processing", icon: LoaderIcon, tone: "info" },
  "video.ready": { label: "Ready", icon: CheckCircle2Icon, tone: "success" },
  "video.failed": { label: "Failed", icon: XCircleIcon, tone: "danger" },
  "video.rejected": { label: "Rejected", icon: BanIcon, tone: "danger" },
  "course.draft": { label: "Draft", icon: FileEditIcon, tone: "neutral" },
  "course.published": { label: "Published", icon: GlobeIcon, tone: "success" },
  "course.locked": { label: "Locked", icon: LockIcon, tone: "warning" },
} as const satisfies Record<string, StatusEntry>;

export type StatusKey = keyof typeof statusEntries;

const unknownIcon = CircleDashedIcon;

export function resolveStatus(kind: StatusKind, value: string): StatusEntry {
  const key = `${kind}.${value.toLowerCase().replaceAll("_", "-")}`;
  if (key in statusEntries) return statusEntries[key as StatusKey];
  return { label: value, icon: unknownIcon, tone: "neutral" };
}
