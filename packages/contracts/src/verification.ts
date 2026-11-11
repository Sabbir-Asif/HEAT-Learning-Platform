import { z } from "zod";
import { emailAddressSchema } from "./auth";
import { captchaFieldsShape } from "./captcha";

export const verificationTokenMaxLength = 512;
export const verificationResendLimit = 5;

export const verifyEmailRequestSchema = z.object({
  token: z.string().min(1).max(verificationTokenMaxLength),
});

export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const verificationResendRequestSchema = z.object({
  email: emailAddressSchema,
  ...captchaFieldsShape,
});

export type VerificationResendRequest = z.infer<typeof verificationResendRequestSchema>;
