import { z } from "zod";

export type MailTlsMode = "none" | "starttls" | "implicit";

export interface MailConfig {
  host: string;
  port: number;
  tls: MailTlsMode;
  auth: { user: string; password: string } | null;
  from: { address: string; name: string };
  timeoutMs: number;
}

const blankToUndefined = (value: unknown): unknown => (value === "" ? undefined : value);

const schema = z.object({
  NODE_ENV: z.string().optional(),
  SMTP_HOST: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  SMTP_PORT: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().positive().max(65535).default(1035),
  ),
  SMTP_TLS: z.preprocess(
    blankToUndefined,
    z.enum(["none", "starttls", "implicit"]).default("none"),
  ),
  SMTP_USER: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  SMTP_PASSWORD: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  SMTP_FROM_ADDRESS: z.preprocess(blankToUndefined, z.email().optional()),
  SMTP_FROM_NAME: z.preprocess(blankToUndefined, z.string().min(1).default("WSAP")),
  SMTP_TIMEOUT_MS: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().positive().default(10000),
  ),
});

const productionRequired = [
  "SMTP_HOST",
  "SMTP_FROM_ADDRESS",
  "SMTP_USER",
  "SMTP_PASSWORD",
] as const;

const productionExplicit = ["SMTP_PORT", "SMTP_TLS"] as const;

const isSet = (env: NodeJS.ProcessEnv, name: string): boolean =>
  env[name] !== undefined && env[name] !== "";

export const loadMailConfig = (env: NodeJS.ProcessEnv): MailConfig => {
  const parsed = schema.safeParse(env);
  const invalid = new Set<string>();
  if (!parsed.success) {
    for (const issue of parsed.error.issues) invalid.add(String(issue.path[0]));
  } else {
    const values = parsed.data;
    if ((values.SMTP_USER === undefined) !== (values.SMTP_PASSWORD === undefined)) {
      invalid.add(values.SMTP_USER === undefined ? "SMTP_USER" : "SMTP_PASSWORD");
    }
    if (values.NODE_ENV === "production") {
      for (const name of productionRequired) {
        if (values[name] === undefined) invalid.add(name);
      }
      for (const name of productionExplicit) {
        if (!isSet(env, name)) invalid.add(name);
      }
    }
    if (values.SMTP_USER !== undefined && values.SMTP_TLS === "none") invalid.add("SMTP_TLS");
  }
  if (!parsed.success || invalid.size > 0) {
    throw new Error(`Invalid environment configuration: ${[...invalid].join(", ")}`);
  }
  const values = parsed.data;
  return {
    host: values.SMTP_HOST ?? "localhost",
    port: values.SMTP_PORT,
    tls: values.SMTP_TLS,
    auth:
      values.SMTP_USER !== undefined && values.SMTP_PASSWORD !== undefined
        ? { user: values.SMTP_USER, password: values.SMTP_PASSWORD }
        : null,
    from: {
      address: values.SMTP_FROM_ADDRESS ?? "noreply@heat.localhost",
      name: values.SMTP_FROM_NAME,
    },
    timeoutMs: values.SMTP_TIMEOUT_MS,
  };
};
