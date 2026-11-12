import { NotFoundException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { CertificatesService } from "../../src/certificates/certificates.service";

const key = `${"b2".repeat(32)}.pdf`;
const actor = { actorId: "a1", ipAddress: "10.0.0.1" };

const row = (overrides: object = {}) => ({
  id: "c1",
  number: "ABCD-EFGH-JKMN",
  fileKey: key,
  revokedAt: null,
  enrollment: { userId: "u1" },
  ...overrides,
});

const build = (found: object | null) => {
  const database = {
    certificate: { findUnique: vi.fn().mockResolvedValue(found) },
    enrollment: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const audit = { recordStandalone: vi.fn().mockResolvedValue(undefined) };
  const service = new CertificatesService(
    database as never,
    { publicAppUrl: "https://learn.example" } as never,
    audit as never,
  );
  return { service, database, audit };
};

describe("CertificatesService.prepareDownload", () => {
  test("the owner gets the accel headers and nothing is audited", async () => {
    const { service, audit } = build(row());

    const headers = await service.prepareDownload({ kind: "student", userId: "u1" }, "c1", actor);

    expect(headers["X-Accel-Redirect"]).toBe(`/internal/certificates/${key}`);
    expect(audit.recordStandalone).not.toHaveBeenCalled();
  });

  test("another student gets the same not found as a missing certificate", async () => {
    const other = await build(row())
      .service.prepareDownload({ kind: "student", userId: "u2" }, "c1", actor)
      .catch((error: unknown) => error);
    const missing = await build(null)
      .service.prepareDownload({ kind: "student", userId: "u2" }, "c1", actor)
      .catch((error: unknown) => error);

    expect(other).toBeInstanceOf(NotFoundException);
    expect(missing).toBeInstanceOf(NotFoundException);
    expect((other as NotFoundException).getResponse()).toEqual(
      (missing as NotFoundException).getResponse(),
    );
  });

  test("a certificate still rendering or revoked is not found for the owner", async () => {
    await expect(
      build(row({ fileKey: null })).service.prepareDownload(
        { kind: "student", userId: "u1" },
        "c1",
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      build(row({ revokedAt: new Date() })).service.prepareDownload(
        { kind: "student", userId: "u1" },
        "c1",
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  test("an admin may download any certificate and the access is audit-logged", async () => {
    const { service, audit } = build(row());

    const headers = await service.prepareDownload({ kind: "admin" }, "c1", actor);

    expect(headers["Content-Type"]).toBe("application/pdf");
    expect(audit.recordStandalone).toHaveBeenCalledWith(actor, {
      action: "certificate.download",
      entity: "Certificate",
      entityId: "c1",
      after: { ownerId: "u1" },
    });
  });

  test("no headers are returned when the audit write fails", async () => {
    const { service, audit } = build(row());
    audit.recordStandalone.mockRejectedValue(new Error("down"));

    await expect(service.prepareDownload({ kind: "admin" }, "c1", actor)).rejects.toThrow("down");
  });

  test("a stored key outside the pattern is never used", async () => {
    await expect(
      build(row({ fileKey: "../../etc/passwd" })).service.prepareDownload(
        { kind: "admin" },
        "c1",
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("CertificatesService.listFor", () => {
  test("reads the caller's enrollments in a single query", async () => {
    const { service, database } = build(null);

    await expect(service.listFor("u1")).resolves.toEqual({ certificates: [] });

    expect(database.enrollment.findMany).toHaveBeenCalledTimes(1);
    expect(database.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "u1" }) }),
    );
  });
});

describe("CertificatesService.verify", () => {
  const verifiable = (overrides: object = {}) => ({
    recipientName: "Rahim Uddin",
    issuedAt: new Date("2026-11-12T10:00:00.000Z"),
    fileKey: key,
    revokedAt: null,
    enrollment: {
      completedAt: new Date("2026-11-10T00:00:00.000Z"),
      updatedAt: new Date("2026-11-11T00:00:00.000Z"),
      course: { title: "HEAT" },
    },
    ...overrides,
  });

  test("looks the certificate up by number and returns the public fields only", async () => {
    const { service, database } = build(verifiable());

    await expect(service.verify("ABCD-EFGH-JKMN")).resolves.toEqual({
      status: "VALID",
      holderName: "Rahim Uddin",
      courseTitle: "HEAT",
      completedAt: "2026-11-10T00:00:00.000Z",
    });
    expect(database.certificate.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { number: "ABCD-EFGH-JKMN" } }),
    );
  });

  test("a revoked certificate is reported as revoked", async () => {
    const { service } = build(verifiable({ revokedAt: new Date() }));

    await expect(service.verify("ABCD-EFGH-JKMN")).resolves.toMatchObject({ status: "REVOKED" });
  });

  test("an unknown number is not found", async () => {
    await expect(build(null).service.verify("NOPE")).rejects.toBeInstanceOf(NotFoundException);
  });
});
