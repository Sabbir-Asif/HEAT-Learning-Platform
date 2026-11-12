import { describe, expect, test, vi } from "vitest";
import { CertificateAdminService } from "../../src/certificates/certificate-admin.service";

const now = new Date("2026-11-12T05:00:00.000Z");
const actor = { actorId: "admin-id", ipAddress: "203.0.113.4", requestId: "req-1" };
const key = `${"c3".repeat(32)}.pdf`;

const stored = (overrides: object = {}) => ({
  id: "cert-id",
  number: "ABCD-EFGH-JKMN",
  enrollmentId: "enrollment-id",
  recipientName: "Old Name",
  fileKey: key,
  fileSha256: "sha",
  revokedAt: null,
  enrollment: { user: { profile: { name: "New Name" } } },
  ...overrides,
});

const build = (found: object | null, claimed = 1) => {
  const tx = {
    certificate: {
      findUnique: vi.fn().mockResolvedValue(found),
      updateMany: vi.fn().mockResolvedValue({ count: claimed }),
    },
    outbox: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    $transaction: vi
      .fn()
      .mockImplementation(async (work: (client: unknown) => unknown) => work(tx)),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new CertificateAdminService(
    database as never,
    { now: () => now },
    audit as never,
  );
  return { service, tx, audit };
};

describe("CertificateAdminService.revoke", () => {
  test("revokes the certificate and audits actor, reason, before and after", async () => {
    const { service, tx, audit } = build(stored());

    const result = await service.revoke("cert-id", actor, "Issued in error");

    expect(result).toEqual({ id: "cert-id", status: "REVOKED", revokedAt: now.toISOString() });
    expect(tx.certificate.updateMany).toHaveBeenCalledWith({
      where: { id: "cert-id", revokedAt: null },
      data: { revokedAt: now },
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      actor,
      expect.objectContaining({
        action: "certificate.revoke",
        entityId: "cert-id",
        before: expect.objectContaining({ status: "ACTIVE" }),
        after: expect.objectContaining({ status: "REVOKED", reason: "Issued in error" }),
      }),
    );
  });

  test("an unknown certificate is not found", async () => {
    await expect(build(null).service.revoke("x", actor, "r")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("an already revoked certificate is refused without writing", async () => {
    const { service, tx, audit } = build(stored({ revokedAt: now }));

    await expect(service.revoke("cert-id", actor, "r")).rejects.toMatchObject({
      code: "CERTIFICATE_REVOKED",
    });
    expect(tx.certificate.updateMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  test("losing the claim to a concurrent revoke is refused and not audited", async () => {
    const { service, audit } = build(stored(), 0);

    await expect(service.revoke("cert-id", actor, "r")).rejects.toMatchObject({
      code: "CERTIFICATE_REVOKED",
    });
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe("CertificateAdminService.reissue", () => {
  test("clears the file, keeps the number, takes the profile name and queues a render", async () => {
    const { service, tx, audit } = build(stored());

    const result = await service.reissue("cert-id", actor, "Name corrected");

    expect(result).toEqual({ id: "cert-id", status: "PENDING" });
    expect(tx.certificate.updateMany).toHaveBeenCalledWith({
      where: { id: "cert-id", revokedAt: null, fileKey: key },
      data: { fileKey: null, fileSha256: null, fileSizeBytes: null, recipientName: "New Name" },
    });
    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: { eventType: "certificate.requested", payload: { enrollmentId: "enrollment-id" } },
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      actor,
      expect.objectContaining({
        action: "certificate.reissue",
        before: expect.objectContaining({ recipientName: "Old Name", status: "READY" }),
        after: expect.objectContaining({
          number: "ABCD-EFGH-JKMN",
          recipientName: "New Name",
          reason: "Name corrected",
        }),
      }),
    );
  });

  test("a revoked or still rendering certificate cannot be reissued", async () => {
    await expect(
      build(stored({ revokedAt: now })).service.reissue("cert-id", actor, "r"),
    ).rejects.toMatchObject({ code: "CERTIFICATE_REVOKED" });
    const pending = build(stored({ fileKey: null }));
    await expect(pending.service.reissue("cert-id", actor, "r")).rejects.toMatchObject({
      code: "CERTIFICATE_NOT_READY",
    });
    expect(pending.tx.outbox.create).not.toHaveBeenCalled();
  });

  test("losing the claim queues nothing and audits nothing", async () => {
    const { service, tx, audit } = build(stored(), 0);

    await expect(service.reissue("cert-id", actor, "r")).rejects.toMatchObject({
      code: "CERTIFICATE_NOT_READY",
    });
    expect(tx.outbox.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
