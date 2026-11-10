import { z } from "zod";
import { academicSessionSchema } from "./academic-session";

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

export const enrollmentStepOneSchema = z.object({
  name: englishNameSchema,
  universityId: z.uuid(),
  facultyId: z.uuid(),
  departmentId: z.uuid(),
  session: academicSessionSchema,
});

export type EnrollmentStepOne = z.infer<typeof enrollmentStepOneSchema>;
export type EnrollmentStepOneInput = z.input<typeof enrollmentStepOneSchema>;
