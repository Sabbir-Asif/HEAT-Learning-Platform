import { describe, expect, test, vi } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import { EnrollmentService } from "../../src/enrollment/enrollment.service";

const request = {
  name: "Anne Smith",
  universityId: "7b1c1d2e-3f4a-4b5c-8d6e-9f0a1b2c3d4e",
  facultyId: "8c2d2e3f-4a5b-4c6d-9e7f-0a1b2c3d4e5f",
  departmentId: "9d3e3f4a-5b6c-4d7e-8f80-1b2c3d4e5f60",
  session: "2020-21",
  email: "anne@example.com",
  password: "correct horse battery",
  confirmPassword: "correct horse battery",
  captchaId: "1b4e28ba-2fa1-41d2-883f-0016d3cca427",
  captchaAnswer: "AB12",
};

const build = () => {
  const order: string[] = [];
  const captcha = {
    verify: vi.fn().mockImplementation(async () => {
      order.push("captcha");
    }),
  };
  const passwords = {
    assertNotBreached: vi.fn().mockImplementation(async () => {
      order.push("breach");
    }),
  };
  const service = new EnrollmentService(captcha as never, passwords as never);
  return { service, captcha, passwords, order };
};

describe("EnrollmentService.submit", () => {
  test("verifies the captcha, then the password, and accepts", async () => {
    const { service, captcha, passwords, order } = build();

    expect(await service.submit(request)).toEqual({ accepted: true });

    expect(captcha.verify).toHaveBeenCalledWith(request.captchaId, request.captchaAnswer);
    expect(passwords.assertNotBreached).toHaveBeenCalledWith(request.password);
    expect(order).toEqual(["captcha", "breach"]);
  });

  test("does not check the password when the captcha fails", async () => {
    const { service, captcha, passwords } = build();
    captcha.verify.mockRejectedValue(new ApiException(400, "CAPTCHA_INVALID"));

    await expect(service.submit(request)).rejects.toMatchObject({ code: "CAPTCHA_INVALID" });
    expect(passwords.assertNotBreached).not.toHaveBeenCalled();
  });

  test("rejects a breached password", async () => {
    const { service, passwords } = build();
    passwords.assertNotBreached.mockRejectedValue(new ApiException(400, "PASSWORD_BREACHED"));

    await expect(service.submit(request)).rejects.toMatchObject({ code: "PASSWORD_BREACHED" });
  });
});
