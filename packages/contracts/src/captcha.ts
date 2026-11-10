import { z } from "zod";

export const captchaTtlSeconds = 300;
export const captchaMaxTries = 3;
export const captchaAnswerMaxLength = 12;

export const captchaRequestSchema = z.object({
  replaces: z.uuid().optional(),
});

export type CaptchaRequest = z.infer<typeof captchaRequestSchema>;

export const captchaResponseSchema = z.object({
  id: z.uuid(),
  svg: z.string(),
  expiresInSeconds: z.number().int().positive(),
});

export type CaptchaResponse = z.infer<typeof captchaResponseSchema>;

export const captchaFieldsShape = {
  captchaId: z.uuid("Request a new security check."),
  captchaAnswer: z
    .string()
    .trim()
    .min(1, "Enter the characters from the image.")
    .max(captchaAnswerMaxLength, "Enter the characters from the image."),
};

export const captchaFieldsSchema = z.object(captchaFieldsShape);

export type CaptchaFields = z.infer<typeof captchaFieldsSchema>;
