import { z } from "zod";

export * from "./academic-session";
export * from "./errors";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
