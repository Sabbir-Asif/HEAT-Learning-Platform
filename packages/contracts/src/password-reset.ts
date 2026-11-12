import { z } from "zod";
import { emailAddressSchema, passwordMaxLength, passwordMinLength } from "./auth";
import { captchaFieldsShape } from "./captcha";

export const resetTokenMaxLength = 512;

export const forgotPasswordRequestSchema = z.object({
  email: emailAddressSchema,
  ...captchaFieldsShape,
});

export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1).max(resetTokenMaxLength),
  password: z.string().min(passwordMinLength).max(passwordMaxLength),
});

export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
