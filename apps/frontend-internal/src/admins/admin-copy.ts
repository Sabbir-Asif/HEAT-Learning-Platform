import type { AdminListResponseDtoItemsItemStatus } from "@heat/api-client";

export const emailInUseMessage = "An account with this email address already exists.";
export const invitationExpiredMessage =
  "This invitation has expired. Ask the super admin to send you a new one.";
export const invitationInvalidMessage =
  "This invitation link is not valid or has already been used. Ask the super admin to send you a new one.";

export const adminStatusLabels: Record<AdminListResponseDtoItemsItemStatus, string> = {
  ACTIVE: "Active",
  INVITED: "Invited",
  INVITE_EXPIRED: "Invite expired",
  DEACTIVATED: "Deactivated",
};

export const adminStatusVariants = {
  ACTIVE: "secondary",
  INVITED: "outline",
  INVITE_EXPIRED: "outline",
  DEACTIVATED: "destructive",
} as const satisfies Record<AdminListResponseDtoItemsItemStatus, string>;

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatDhakaTime = (iso: string): string => formatter.format(new Date(iso));
