import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

export const secretMatches = (expected: string, provided: string | null): boolean => {
  if (provided === null) return false;
  return timingSafeEqual(digest(expected), digest(provided));
};

const proxyHeaders = ["x-real-ip", "forwarded"] as const;

export type RevalidateDecision = { kind: "allowed" } | { kind: "refused"; status: 401 | 403 | 503 };

export const decideRevalidation = (input: {
  expectedSecret: string | undefined;
  providedSecret: string | null;
  headers: Headers;
}): RevalidateDecision => {
  if (input.expectedSecret === undefined || input.expectedSecret === "") {
    return { kind: "refused", status: 503 };
  }
  if (proxyHeaders.some((name) => input.headers.has(name))) {
    return { kind: "refused", status: 403 };
  }
  if (!secretMatches(input.expectedSecret, input.providedSecret)) {
    return { kind: "refused", status: 401 };
  }
  return { kind: "allowed" };
};
