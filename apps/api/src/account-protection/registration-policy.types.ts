import type { HeatClient } from "@heat/db";

export type RegistrationPolicyTransaction = Pick<
  HeatClient,
  | "$executeRaw"
  | "$queryRaw"
  | "user"
  | "studentProfile"
  | "enrollment"
  | "authToken"
  | "session"
  | "outbox"
  | "auditLog"
>;

export type RegistrationOutcome =
  | { kind: "PROCEED"; replacedUserId: string | null }
  | { kind: "ALREADY_REGISTERED"; userId: string };

export type AlreadyRegisteredPayload = {
  template: string;
  userId: string;
};
