import { z } from "zod";

export * from "./academic-session";
export * from "./admins";
export * from "./audit";
export * from "./auth";
export * from "./captcha";
export * from "./directory";
export * from "./enrollment";
export * from "./errors";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
