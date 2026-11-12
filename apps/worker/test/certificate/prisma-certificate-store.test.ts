import { describe, expect, test, vi } from "vitest";
import {
  PrismaCertificateStore,
  issuedEventPayload,
} from "../../src/certificate/prisma-certificate-store";

const enrollmentId = "0194f3a0-0000-7000-8000-000000000001";
const completedAt = new Date("2026-11-10T00:00:00.000Z");
const updatedAt = new Date("2026-11-11T00:00:00.000Z");

const row = (overrides: Record<string, unknown> = {}) => ({
  id: enrollmentId,
  userId: "user-id",
  courseId: "course-id",
  status: "COMPLETED",
  completedAt,
  updatedAt,
  course: { title: "Gender Safety Basics" },
  user: { emailVerifiedAt: new Date(), profile: { name: "Amina Rahman" } },
  certificate: null,
  ...overrides,
});

const build = () => {
  const tx = {
    certificate: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    outbox: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    enrollment: { findUnique: vi.fn().mockResolvedValue(row()) },
    certificate: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation((run: (client: typeof tx) => unknown) => run(tx)),
  };
  return { store: new PrismaCertificateStore(database as never), database, tx };
};

const event = {
  certificateId: "certificate-id",
  enrollmentId,
  userId: "user-id",
  courseTitle: "Gender Safety Basics",
  number: "ABCD-EFGH-JKMN",
};
const file = { key: "k.pdf", sha256: "sha", sizeBytes: 12 };

describe("PrismaCertificateStore.load", () => {
  test("maps the enrollment, profile name and verification state", async () => {
    const { store } = build();
    expect(await store.load(enrollmentId)).toEqual({
      enrollmentId,
      userId: "user-id",
      courseId: "course-id",
      courseTitle: "Gender Safety Basics",
      holderName: "Amina Rahman",
      enrollmentStatus: "COMPLETED",
      emailVerified: true,
      completedAt,
      certificate: null,
    });
  });

  test("falls back to an empty name, unverified and the update time", async () => {
    const { store, database } = build();
    database.enrollment.findUnique.mockResolvedValue(
      row({ completedAt: null, user: { emailVerifiedAt: null, profile: null } }),
    );
    const source = await store.load(enrollmentId);
    expect(source?.holderName).toBe("");
    expect(source?.emailVerified).toBe(false);
    expect(source?.completedAt).toEqual(updatedAt);
  });

  test("returns null for an unknown enrollment", async () => {
    const { store, database } = build();
    database.enrollment.findUnique.mockResolvedValue(null);
    expect(await store.load(enrollmentId)).toBeNull();
  });
});

describe("PrismaCertificateStore.create", () => {
  const input = {
    enrollmentId,
    number: "ABCD-EFGH-JKMN",
    recipientName: "Amina Rahman",
    issuedAt: new Date(),
  };

  test("returns the created row", async () => {
    const { store, database } = build();
    const created = { id: "c", number: input.number };
    database.certificate.create.mockResolvedValue(created);
    expect(await store.create(input)).toEqual({ outcome: "created", certificate: created });
  });

  test("reports a duplicate when the enrollment already has a certificate", async () => {
    const { store, database } = build();
    database.certificate.create.mockRejectedValue({ code: "P2002" });
    database.certificate.findUnique.mockResolvedValue({ id: "existing" });
    expect(await store.create(input)).toEqual({ outcome: "duplicate" });
  });

  test("reports a number collision when no certificate exists for the enrollment", async () => {
    const { store, database } = build();
    database.certificate.create.mockRejectedValue({ code: "P2002" });
    database.certificate.findUnique.mockResolvedValue(null);
    expect(await store.create(input)).toEqual({ outcome: "number-taken" });
  });

  test.each([new Error("connection lost"), "text", null])("rethrows %s", async (failure) => {
    const { store, database } = build();
    database.certificate.create.mockRejectedValue(failure);
    await expect(store.create(input)).rejects.toBe(failure);
  });
});

describe("PrismaCertificateStore.finalise", () => {
  test("stores the file and queues the issued event in one transaction", async () => {
    const { store, tx } = build();

    expect(await store.finalise("certificate-id", file, event)).toBe(true);

    expect(tx.certificate.updateMany).toHaveBeenCalledWith({
      where: {
        id: "certificate-id",
        OR: [{ fileKey: null }, { fileSha256: null }, { fileSizeBytes: null }],
      },
      data: { fileKey: "k.pdf", fileSha256: "sha", fileSizeBytes: 12 },
    });
    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: { eventType: "certificate.issued", payload: issuedEventPayload(event) },
    });
  });

  test("queues nothing when the certificate was already finalised", async () => {
    const { store, tx } = build();
    tx.certificate.updateMany.mockResolvedValue({ count: 0 });
    expect(await store.finalise("certificate-id", file, event)).toBe(false);
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });
});

describe("issuedEventPayload", () => {
  test("drives the completion email and the in-app notification with ids and the code", () => {
    expect(issuedEventPayload(event)).toEqual({
      template: "certificate-ready",
      userId: "user-id",
      courseTitle: "Gender Safety Basics",
      certificateCode: "ABCD-EFGH-JKMN",
      notification: {
        type: "CERTIFICATE_READY",
        data: { certificateId: "certificate-id", enrollmentId },
      },
    });
  });
});
