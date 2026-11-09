import { z } from "zod";

const sessionPattern = /^(\d{4})-(\d{2})$/;

const endsInNextYear = (value: string): boolean => {
  const match = sessionPattern.exec(value);
  if (!match) return false;
  const [, start = "", end = ""] = match;
  return (Number(start) + 1) % 100 === Number(end);
};

export const academicSessionSchema = z.string().regex(sessionPattern).refine(endsInNextYear);

export type AcademicSession = z.infer<typeof academicSessionSchema>;
