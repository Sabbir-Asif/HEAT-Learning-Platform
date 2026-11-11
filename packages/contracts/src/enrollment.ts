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
