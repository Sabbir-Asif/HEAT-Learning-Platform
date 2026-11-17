import { z } from "zod";
import { passwordMaxLength, passwordMinLength } from "./auth";
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
  avatarUrl: z.string().min(1).max(2048).nullable(),
});

export type ProfileResponse = z.infer<typeof profileResponseSchema>;

export const updateProfileRequestSchema = enrollmentStepOneSchema;

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type UpdateProfileRequestInput = z.input<typeof updateProfileRequestSchema>;

export const avatarResponseSchema = z.object({ avatarUrl: z.string() });

export type AvatarResponse = z.infer<typeof avatarResponseSchema>;

export const avatarDisplayWidth = 320;

export const passwordCodeLength = 6;
export const passwordCodeLifetimeMinutes = 15;
export const passwordCodeMaxAttempts = 5;

export const passwordCodeRequestedResponseSchema = z.object({
  expiresInMinutes: z.number().int().positive(),
});

export type PasswordCodeRequestedResponse = z.infer<typeof passwordCodeRequestedResponseSchema>;

export const changeStudentPasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(passwordMaxLength),
    code: z
      .string()
      .trim()
      .regex(
        new RegExp(`^\\d{${passwordCodeLength}}$`),
        `Enter the ${passwordCodeLength}-digit code.`,
      ),
    newPassword: z
      .string()
      .min(passwordMinLength, `Use at least ${passwordMinLength} characters.`)
      .max(passwordMaxLength, `Use at most ${passwordMaxLength} characters.`),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ["newPassword"],
    message: "Choose a password you have not used here before.",
  });

export type ChangeStudentPasswordRequest = z.infer<typeof changeStudentPasswordRequestSchema>;
