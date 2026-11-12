import { z } from "zod";
import { academicSessionSchema } from "./academic-session";
import {
  emailAddressSchema,
  enrollmentStatusSchema,
  passwordMaxLength,
  passwordMinLength,
} from "./auth";
import { captchaFieldsShape } from "./captcha";
import { courseSlugSchema } from "./courses";

export const englishNameMinLength = 2;
export const englishNameMaxLength = 100;
export const englishNameMessage = "Enter your name in English letters.";

const englishNamePattern = /^[A-Za-z .'-]+$/;

export const englishNameSchema = z
  .string({ error: englishNameMessage })
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(englishNameMinLength, { error: englishNameMessage, abort: true })
      .max(englishNameMaxLength, { error: englishNameMessage, abort: true })
      .regex(englishNamePattern, { error: englishNameMessage }),
  );

export const universityRequiredMessage = "Select your university.";
export const facultyRequiredMessage = "Select your faculty.";
export const departmentRequiredMessage = "Select your department.";

export const enrollmentStepOneSchema = z.object({
  name: englishNameSchema,
  universityId: z.uuid({ error: universityRequiredMessage }),
  facultyId: z.uuid({ error: facultyRequiredMessage }),
  departmentId: z.uuid({ error: departmentRequiredMessage }),
  session: academicSessionSchema,
});

export type EnrollmentStepOne = z.infer<typeof enrollmentStepOneSchema>;
export type EnrollmentStepOneInput = z.input<typeof enrollmentStepOneSchema>;

export const passwordConfirmationRequiredMessage = "Retype your password.";
export const passwordMismatchMessage = "The passwords do not match.";

const passwordSchema = z
  .string({ error: `Use at least ${passwordMinLength} characters.` })
  .min(passwordMinLength, `Use at least ${passwordMinLength} characters.`)
  .max(passwordMaxLength, `Use at most ${passwordMaxLength} characters.`);

const stepTwoShape = {
  email: emailAddressSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, passwordConfirmationRequiredMessage),
  ...captchaFieldsShape,
};

const passwordsMatch = (value: { password: string; confirmPassword: string }): boolean =>
  value.password === value.confirmPassword;

const passwordMismatch = { path: ["confirmPassword"], message: passwordMismatchMessage };

export const enrollmentStepTwoSchema = z
  .object(stepTwoShape)
  .refine(passwordsMatch, passwordMismatch);

export type EnrollmentStepTwo = z.infer<typeof enrollmentStepTwoSchema>;
export type EnrollmentStepTwoInput = z.input<typeof enrollmentStepTwoSchema>;

export const enrollmentRequestSchema = z
  .object({ ...enrollmentStepOneSchema.shape, ...stepTwoShape, courseSlug: courseSlugSchema })
  .refine(passwordsMatch, passwordMismatch);

export type EnrollmentRequest = z.infer<typeof enrollmentRequestSchema>;

export const enrollmentAcceptedResponseSchema = z.object({
  accepted: z.literal(true),
});

export type EnrollmentAcceptedResponse = z.infer<typeof enrollmentAcceptedResponseSchema>;

export const signedInEnrollmentRequestSchema = z.object({ courseSlug: courseSlugSchema });

export type SignedInEnrollmentRequest = z.infer<typeof signedInEnrollmentRequestSchema>;

export const signedInEnrollmentResponseSchema = z.object({
  enrollmentId: z.uuid(),
  courseSlug: courseSlugSchema,
  status: enrollmentStatusSchema,
});

export type SignedInEnrollmentResponse = z.infer<typeof signedInEnrollmentResponseSchema>;
