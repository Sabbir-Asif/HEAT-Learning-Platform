import { z } from "zod";
import { enrollmentStepOneSchema } from "./enrollment";

export const profileLockedMessage =
  "Your name and academic details are locked. Send a change request to update them.";

export const namedReferenceSchema = z.object({ id: z.uuid(), name: z.string() });

export const profileResponseSchema = z.object({
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  university: namedReferenceSchema,
  faculty: namedReferenceSchema,
  department: namedReferenceSchema,
  session: z.string(),
  locked: z.boolean(),
  avatarUrl: z.string().nullable(),
});

export type ProfileResponse = z.infer<typeof profileResponseSchema>;

export const updateProfileRequestSchema = enrollmentStepOneSchema;

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type UpdateProfileRequestInput = z.input<typeof updateProfileRequestSchema>;

export const avatarResponseSchema = z.object({ avatarUrl: z.string() });

export type AvatarResponse = z.infer<typeof avatarResponseSchema>;

export const avatarDisplayWidth = 320;
