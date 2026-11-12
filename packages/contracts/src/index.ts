import { z } from "zod";

export * from "./academic-session";
export * from "./admins";
export * from "./approvals";
export * from "./audit";
export * from "./auth";
export * from "./captcha";
export * from "./certificates";
export * from "./contact-settings";
export * from "./courses";
export * from "./dashboard";
export * from "./directory";
export * from "./enrollment";
export * from "./errors";
export * from "./learning";
export * from "./media";
export * from "./modules";
export * from "./notifications";
export * from "./news";
export * from "./playback";
export * from "./profile";
export * from "./progress";
export * from "./public-cache";
export * from "./quiz-delivery";
export * from "./quizzes";
export * from "./attempt-grants";
export * from "./removals";
export * from "./students";
export * from "./password-reset";
export * from "./rich-text";
export * from "./site-settings";
export * from "./students";
export * from "./tags";
export * from "./verification";
export * from "./videos";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
