import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { realmCookies } from "../../src/auth";
import { StudentAuthController } from "../../src/student-auth/student-auth.controller";

const session = { userId: "user-id", familyId: "family" };
const response = {};
const profile = { user: { id: "user-id" }, enrollments: [] };

const build = () => {
  const signInService = {
    signIn: vi.fn().mockResolvedValue({ userId: "user-id", tokens: { access: "a", refresh: "r" } }),
  };
  const sessions = {
    refresh: vi.fn().mockResolvedValue({ access: "a2", refresh: "r2" }),
    revoke: vi.fn().mockResolvedValue(undefined),
  };
  const cookies = {
    write: vi.fn(),
    clear: vi.fn(),
    writeCsrf: vi.fn().mockReturnValue("csrf-token"),
  };
  const me = { describe: vi.fn().mockResolvedValue(profile) };
  const controller = new StudentAuthController(
    signInService as never,
    sessions as never,
    cookies as never,
    me as never,
  );
  return { controller, signInService, sessions, cookies, me };
};

describe("StudentAuthController.signIn", () => {
  test("passes a truncated user agent and the address, writes the cookies and returns the profile", async () => {
    const { controller, signInService, cookies, me } = build();
    const request = { headers: { "user-agent": "x".repeat(400) }, ip: "203.0.113.4" };

    const result = await controller.signIn(
      { email: "a@example.test", password: "secret" },
      request as never,
      response as never,
    );

    expect(signInService.signIn).toHaveBeenCalledWith("a@example.test", "secret", {
      userAgent: "x".repeat(255),
      ipAddress: "203.0.113.4",
    });
    expect(cookies.write).toHaveBeenCalledWith(response, "student", {
      access: "a",
      refresh: "r",
    });
    expect(me.describe).toHaveBeenCalledWith("user-id");
    expect(result).toBe(profile);
  });

  test("copes with a missing user agent", async () => {
    const { controller, signInService } = build();

    await controller.signIn(
      { email: "a@example.test", password: "secret" },
      { headers: {}, ip: "203.0.113.4" } as never,
      response as never,
    );

    expect(signInService.signIn).toHaveBeenCalledWith("a@example.test", "secret", {
      userAgent: undefined,
      ipAddress: "203.0.113.4",
    });
  });
});

describe("StudentAuthController.refresh", () => {
  test("rejects a request without the refresh cookie", async () => {
    const { controller, sessions } = build();

    await expect(
      controller.refresh({ headers: {} } as never, response as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.refresh).not.toHaveBeenCalled();
  });

  test("rotates the tokens and writes the new cookies", async () => {
    const { controller, sessions, cookies } = build();
    const request = { headers: { cookie: `${realmCookies.student.refresh}=token` } };

    await controller.refresh(request as never, response as never);

    expect(sessions.refresh).toHaveBeenCalledWith("token", "student");
    expect(cookies.write).toHaveBeenCalledWith(response, "student", {
      access: "a2",
      refresh: "r2",
    });
  });

  test("clears the cookies when the refresh token is rejected", async () => {
    const { controller, sessions, cookies } = build();
    sessions.refresh.mockRejectedValue(new UnauthorizedException());
    const request = { headers: { cookie: `${realmCookies.student.refresh}=token` } };

    await expect(controller.refresh(request as never, response as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(cookies.clear).toHaveBeenCalledWith(response, "student");
  });

  test("keeps the cookies when the failure is not an authentication failure", async () => {
    const { controller, sessions, cookies } = build();
    sessions.refresh.mockRejectedValue(new Error("redis down"));
    const request = { headers: { cookie: `${realmCookies.student.refresh}=token` } };

    await expect(controller.refresh(request as never, response as never)).rejects.toThrow(
      "redis down",
    );
    expect(cookies.clear).not.toHaveBeenCalled();
  });
});

describe("StudentAuthController.signOut and csrfToken", () => {
  test("signOut revokes the family and clears the cookies", async () => {
    const { controller, sessions, cookies } = build();

    await controller.signOut(session as never, response as never);

    expect(sessions.revoke).toHaveBeenCalledWith("family");
    expect(cookies.clear).toHaveBeenCalledWith(response, "student");
  });

  test("csrfToken issues a token bound to the family", () => {
    const { controller, cookies } = build();

    expect(controller.csrfToken(session as never, response as never)).toEqual({
      token: "csrf-token",
    });
    expect(cookies.writeCsrf).toHaveBeenCalledWith(response, "student", "family");
  });
});
