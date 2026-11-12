import { contactSettingsRequestSchema, emptyContactSettings } from "@heat/contracts";
import type { ContactSettingsRequest } from "@heat/contracts";

export const readStoredContactSettings = (value: unknown): ContactSettingsRequest => {
  const parsed = contactSettingsRequestSchema.safeParse(value);
  return parsed.success ? parsed.data : emptyContactSettings;
};
