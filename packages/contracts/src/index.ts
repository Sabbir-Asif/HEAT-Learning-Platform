import { z } from "zod";

export * from "./academic-session";
export * from "./admins";
export * from "./approvals";
export * from "./audit";
export * from "./auth";
export * from "./captcha";
export * from "./courses";
export * from "./directory";
export * from "./enrollment";
export * from "./errors";
export * from "./modules";
export * from "./quizzes";
export * from "./verification";
export * from "./videos";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
