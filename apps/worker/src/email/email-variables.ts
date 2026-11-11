import { z } from "zod";

export const text = z.string().trim().min(1).max(500);
export const opaque = z.string().min(1).max(512).regex(/\S/);
export const reason = z.string().trim().min(1).max(2000);
