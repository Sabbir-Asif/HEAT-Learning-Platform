import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { realmCookies } from "../../src/auth";
import { AdminAuthController } from "../../src/admin-auth/admin-auth.controller";

const session = { userId: "admin-id", familyId: "family" };

const build = (recordSignOut: () => Promise<void>) => {
  const cookies = { clear: vi.fn() };
  const sessions = { revoke: vi.fn().mockResolvedValue(undefined) };
  const controller = new AdminAuthController(
    {} as never,
    sessions as never,
    cookies as never,
    { recordSignOut } as never,
  );
  return { controller, cookies, sessions };
};

const request = { headers: {}, ip: "127.0.0.1" };
const response = {};

describe("AdminAuthController.signOut", () => {
  test("revokes the session, audits and clears the cookies", async () => {
    const { controller, cookies, sessions } = build(async () => undefined);

    await controller.signOut(session as never, request as never, response as never);

    expect(sessions.revoke).toHaveBeenCalledWith("family");
    expect(cookies.clear).toHaveBeenCalledWith(response, "admin");
  });

  test("still clears the cookies when the audit write fails", async () => {
    const { controller, cookies } = build(async () => {
      throw new Error("audit failed");
    });

    await expect(
      controller.signOut(session as never, request as never, response as never),
    ).rejects.toThrow("audit failed");

    expect(cookies.clear).toHaveBeenCalledWith(response, "admin");
  });
});

describe("AdminAuthController other routes", () => {
  const profile = { id: "admin-id" };
  const make = () => {
    const signInService = {
      signIn: vi.fn().mockResolvedValue({ userId: "admin-id", tokens: { access: "a" } }),
    };
    const sessions = { refresh: vi.fn().mockResolvedValue({ access: "a2" }) };
    const cookies = {
      write: vi.fn(),
      clear: vi.fn(),
      writeCsrf: vi.fn().mockReturnValue("csrf-token"),
    };
    const account = { describe: vi.fn().mockResolvedValue(profile) };
    const controller = new AdminAuthController(
      signInService as never,
      sessions as never,
      cookies as never,
      account as never,
    );
    return { controller, signInService, sessions, cookies, account };
  };

  test("signIn passes the audit actor and the truncated agent, then writes cookies", async () => {
    const { controller, signInService, cookies } = make();
    const signInRequest = {
      headers: { "user-agent": "y".repeat(300), "x-request-id": "req-1" },
      ip: "203.0.113.4",
    };

    const result = await controller.signIn(
      { email: "a@example.test", password: "secret" },
      signInRequest as never,
      response as never,
    );

    expect(result).toBe(profile);
    expect(signInService.signIn).toHaveBeenCalledWith(
      "a@example.test",
      "secret",
      { userAgent: "y".repeat(255), ipAddress: "203.0.113.4" },
      { actorId: null, ipAddress: "203.0.113.4", requestId: "req-1" },
    );
    expect(cookies.write).toHaveBeenCalledWith(response, "admin", { access: "a" });
  });

  test("refresh needs the cookie, rotates it and clears on rejection", async () => {
    const { controller, sessions, cookies } = make();

    await expect(controller.refresh({ headers: {} } as never, response as never)).rejects.toThrow();

    const withCookie = { headers: { cookie: `${realmCookies.admin.refresh}=token` } };
    await controller.refresh(withCookie as never, response as never);
    expect(sessions.refresh).toHaveBeenCalledWith("token", "admin");
    expect(cookies.write).toHaveBeenCalledWith(response, "admin", { access: "a2" });

    sessions.refresh.mockRejectedValue(new UnauthorizedException());
    await expect(controller.refresh(withCookie as never, response as never)).rejects.toThrow();
    expect(cookies.clear).toHaveBeenCalledWith(response, "admin");

    cookies.clear.mockClear();
    sessions.refresh.mockRejectedValue(new Error("redis down"));
    await expect(controller.refresh(withCookie as never, response as never)).rejects.toThrow(
      "redis down",
    );
    expect(cookies.clear).not.toHaveBeenCalled();
  });

  test("csrfToken issues a token bound to the family", () => {
    const { controller, cookies } = make();

    expect(controller.csrfToken(session as never, response as never)).toEqual({
      token: "csrf-token",
    });
    expect(cookies.writeCsrf).toHaveBeenCalledWith(response, "admin", "family");
  });
});
