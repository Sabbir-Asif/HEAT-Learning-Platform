import { describe, expect, test, vi } from "vitest";
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
