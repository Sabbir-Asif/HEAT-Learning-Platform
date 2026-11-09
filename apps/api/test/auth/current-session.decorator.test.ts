import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, test } from "vitest";
import type { AuthenticatedSession } from "../../src/auth/auth.types";
import type { AuthenticatedRequest } from "../../src/auth/authenticated-request";
import { CurrentSession } from "../../src/auth/current-session.decorator";

const session: AuthenticatedSession = {
  userId: "u",
  familyId: "f",
  realm: "student",
  role: "STUDENT",
};

class Probe {
  handler(@CurrentSession() current: AuthenticatedSession): AuthenticatedSession {
    return current;
  }
}

const factory = (): ((data: unknown, context: ExecutionContext) => AuthenticatedSession) => {
  const metadata = Reflect.getMetadata("__routeArguments__", Probe, "handler") as Record<
    string,
    { factory: (data: unknown, context: ExecutionContext) => AuthenticatedSession }
  >;
  const entry = Object.values(metadata)[0];
  if (entry === undefined) throw new Error("decorator not registered");
  return entry.factory;
};

const contextFor = (request: AuthenticatedRequest): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

describe("CurrentSession", () => {
  test("returns the session the guard attached", () => {
    expect(factory()(undefined, contextFor({ headers: {}, authSession: session }))).toEqual(
      session,
    );
  });

  test("is unauthorised when no session was attached", () => {
    expect(() => factory()(undefined, contextFor({ headers: {} }))).toThrow(UnauthorizedException);
  });
});
