import { z } from "zod";
import type { EmailQuotaConfig } from "./email-quota";

const blankToUndefined = (value: unknown): unknown => (value === "" ? undefined : value);

const count = (fallback: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().nonnegative().default(fallback));

const schema = z.object({
  EMAIL_DAILY_LIMIT: count(500),
  EMAIL_RESERVED_CAPACITY: count(150),
  EMAIL_BUDGET_VERIFICATION: count(300),
  EMAIL_BUDGET_PASSWORD: count(150),
  EMAIL_BUDGET_ENROLLMENT: count(150),
  EMAIL_BUDGET_CERTIFICATE: count(100),
});

export const loadEmailQuotaConfig = (env: NodeJS.ProcessEnv): EmailQuotaConfig => {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const names = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
    throw new Error(`Invalid environment configuration: ${[...names].join(", ")}`);
  }
  const values = parsed.data;
  if (values.EMAIL_RESERVED_CAPACITY > values.EMAIL_DAILY_LIMIT) {
    throw new Error("Invalid environment configuration: EMAIL_RESERVED_CAPACITY");
  }
  return {
    totalLimit: values.EMAIL_DAILY_LIMIT,
    reservedForPriority: values.EMAIL_RESERVED_CAPACITY,
    budgets: {
      VERIFICATION: values.EMAIL_BUDGET_VERIFICATION,
      PASSWORD: values.EMAIL_BUDGET_PASSWORD,
      ENROLLMENT: values.EMAIL_BUDGET_ENROLLMENT,
      CERTIFICATE: values.EMAIL_BUDGET_CERTIFICATE,
    },
  };
};
