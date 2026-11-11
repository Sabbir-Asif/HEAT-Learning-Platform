import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AdminCertificatesController } from "../../src/certificates/admin-certificates.controller";
import { CertificatesController } from "../../src/certificates/certificates.controller";
import { MeCertificatesController } from "../../src/certificates/me-certificates.controller";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";

describe("certificate controllers", () => {
  test("access and rate limit metadata", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, CertificatesController)).toBe("student");
    expect(Reflect.getMetadata(AUDIENCE_KEY, MeCertificatesController)).toBe("student");
    expect(Reflect.getMetadata(AUDIENCE_KEY, AdminCertificatesController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, AdminCertificatesController)).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
    expect(
      Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, CertificatesController.prototype.download),
    ).toBe("certificateDownload");
    expect(
      Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, AdminCertificatesController.prototype.download),
    ).toBe("certificateDownload");
    expect(
      Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, MeCertificatesController.prototype.list),
    ).toBe("learningRead");
  });

  test("the student download sets the headers and returns no body", async () => {
    const prepareDownload = vi
      .fn()
      .mockResolvedValue({ "X-Accel-Redirect": "/internal/certificates/k" });
    const setHeader = vi.fn();
    const controller = new CertificatesController({ prepareDownload } as never);

    const result = await controller.download(
      { id: "c1" },
      { userId: "u1" } as never,
      { headers: {}, ip: "10.0.0.1" } as never,
      { setHeader },
    );

    expect(result).toBeUndefined();
    expect(prepareDownload).toHaveBeenCalledWith(
      { kind: "student", userId: "u1" },
      "c1",
      expect.objectContaining({ actorId: "u1" }),
    );
    expect(setHeader).toHaveBeenCalledWith("X-Accel-Redirect", "/internal/certificates/k");
  });

  test("the admin download passes the admin viewer and actor", async () => {
    const prepareDownload = vi.fn().mockResolvedValue({});
    const controller = new AdminCertificatesController({ prepareDownload } as never);

    await controller.download(
      { id: "c1" },
      { userId: "a1" } as never,
      { headers: {}, ip: "10.0.0.1" } as never,
      { setHeader: vi.fn() },
    );

    expect(prepareDownload).toHaveBeenCalledWith(
      { kind: "admin" },
      "c1",
      expect.objectContaining({ actorId: "a1", ipAddress: "10.0.0.1" }),
    );
  });

  test("the list passes only the session user", async () => {
    const listFor = vi.fn().mockResolvedValue({ certificates: [] });
    await new MeCertificatesController({ listFor } as never).list({ userId: "u1" } as never);
    expect(listFor).toHaveBeenCalledWith("u1");
  });
});
