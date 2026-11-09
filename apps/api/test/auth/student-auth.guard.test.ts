import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, test, vi } from "vitest";
import type { AuthenticatedSession } from "../../src/auth/auth.types";
import type { AuthenticatedRequest } from "../../src/auth/authenticated-request";
import { CurrentSession } from "../../src/auth/current-session.decorator";
import { Public } from "../../src/auth/public.decorator";
import type { SessionService } from "../../src/auth/session.service";
import { StudentAuthGuard } from "../../src/auth/student-auth.guard";

const session: AuthenticatedSession = {
  userId: "u",
  familyId: "f",
  realm: "student",
  role: "STUDENT",
};

class PlainController {
  handler(): void {}
}

class OpenController {
  @Public()
  handler(): void {}
}

const contextFor = (
  controller: new () => object,
  request: AuthenticatedRequest,
): ExecutionContext =>
  ({
    getHandler: () => Reflect.get(controller.prototype, "handler") as () => void,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const build = (authenticate: SessionService["authenticate"]) =>
  new StudentAuthGuard({ authenticate } as unknown as SessionService, new Reflector());

describe("StudentAuthGuard", () => {
  test("authenticates the student access cookie and attaches the session", async () => {
    const authenticate = vi.fn().mockResolvedValue(session);
    const request: AuthenticatedRequest = {
      headers: { cookie: "__Host-heat_access=abc; other=1" },
    };

    await expect(
      build(authenticate).canActivate(contextFor(PlainController, request)),
    ).resolves.toBe(true);

    expect(authenticate).toHaveBeenCalledWith("abc", "student");
    expect(request.authSession).toEqual(session);
  });

  test("rejects a request without the access cookie", async () => {
    const authenticate = vi.fn();

    await expect(
      build(authenticate).canActivate(contextFor(PlainController, { headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticate).not.toHaveBeenCalled();
  });

  test("lets a route marked public through without a cookie", async () => {
    const authenticate = vi.fn();

    await expect(
      build(authenticate).canActivate(contextFor(OpenController, { headers: {} })),
    ).resolves.toBe(true);
    expect(authenticate).not.toHaveBeenCalled();
  });

  test("propagates a failed authentication", async () => {
    const authenticate = vi.fn().mockRejectedValue(new UnauthorizedException());

    await expect(
      build(authenticate).canActivate(
        contextFor(PlainController, { headers: { cookie: "__Host-heat_access=bad" } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe("CurrentSession", () => {
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

  test("returns the session the guard attached", () => {
    const context = contextFor(PlainController, { headers: {}, authSession: session });

    expect(factory()(undefined, context)).toEqual(session);
  });

  test("is unauthorised when no session was attached", () => {
    const context = contextFor(PlainController, { headers: {} });

    expect(() => factory()(undefined, context)).toThrow(UnauthorizedException);
  });
});
