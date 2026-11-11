import { z } from "zod";

const sessionPattern = /^(\d{4})-(\d{2})$/;

export const academicSessionMessage =
  "Use the format 2020-21, where the second part is the next year.";

const endsInNextYear = (value: string): boolean => {
  const match = sessionPattern.exec(value);
  if (!match) return false;
  const [, start = "", end = ""] = match;
  return (Number(start) + 1) % 100 === Number(end);
};

export const academicSessionSchema = z
  .string({ error: academicSessionMessage })
  .regex(sessionPattern, { error: academicSessionMessage, abort: true })
  .refine(endsInNextYear, { error: academicSessionMessage });

export type AcademicSession = z.infer<typeof academicSessionSchema>;
