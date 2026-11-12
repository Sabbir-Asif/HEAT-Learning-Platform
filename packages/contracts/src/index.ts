import { z } from "zod";

export * from "./academic-session";
export * from "./admins";
export * from "./approvals";
export * from "./audit";
export * from "./auth";
export * from "./captcha";
export * from "./certificates";
export * from "./courses";
export * from "./dashboard";
export * from "./directory";
export * from "./enrollment";
export * from "./errors";
export * from "./learning";
export * from "./modules";
export * from "./notifications";
export * from "./playback";
export * from "./progress";
export * from "./quiz-delivery";
export * from "./quizzes";
export * from "./removals";
export * from "./students";
export * from "./password-reset";
export * from "./verification";
export * from "./videos";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
