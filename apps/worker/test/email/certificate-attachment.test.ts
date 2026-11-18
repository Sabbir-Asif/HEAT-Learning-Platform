import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  AttachmentUnavailable,
  CertificateAttachmentSource,
  type CertificateFileRecord,
} from "../../src/email/certificate-attachment";

const bytes = new TextEncoder().encode("%PDF-1.7 certificate");
const sha256 = createHash("sha256").update(bytes).digest("hex");

const record = (overrides: Partial<CertificateFileRecord> = {}): CertificateFileRecord => ({
  number: "ABC123",
  fileKey: "k.pdf",
  fileSha256: sha256,
  revokedAt: null,
  ...overrides,
});

const setup = (
  found: CertificateFileRecord | null = record(),
  content: Uint8Array | Error = bytes,
) => {
  const requested: string[] = [];
  const source = new CertificateAttachmentSource(
    {
      findByNumber: (number) => {
        requested.push(number);
        return Promise.resolve(found);
      },
    },
    {
      read: () => (content instanceof Error ? Promise.reject(content) : Promise.resolve(content)),
    },
  );
  return { source, requested };
};

const payload = { certificateCode: "ABC123" };

describe("CertificateAttachmentSource", () => {
  test("attaches the stored PDF named after the certificate number", async () => {
    const { source, requested } = setup();

    const attachments = await source.load("certificate-ready", payload);

    expect(requested).toEqual(["ABC123"]);
    expect(attachments).toEqual([
      {
        filename: "WSAP-certificate-ABC123.pdf",
        content: Buffer.from(bytes),
        contentType: "application/pdf",
      },
    ]);
  });

  test("attaches nothing for other templates", async () => {
    const { source, requested } = setup();
    expect(await source.load("password-reset", payload)).toEqual([]);
    expect(requested).toEqual([]);
  });

  test("fails when the payload has no certificate code", async () => {
    await expect(setup().source.load("certificate-ready", {})).rejects.toBeInstanceOf(
      AttachmentUnavailable,
    );
  });

  test("fails when the certificate, its file or its checksum is missing", async () => {
    for (const found of [
      null,
      record({ fileKey: null }),
      record({ fileSha256: null }),
      record({ revokedAt: new Date() }),
    ]) {
      await expect(setup(found).source.load("certificate-ready", payload)).rejects.toBeInstanceOf(
        AttachmentUnavailable,
      );
    }
  });

  test("fails when the PDF is missing from storage", async () => {
    const { source } = setup(record(), new Error("ENOENT"));
    await expect(source.load("certificate-ready", payload)).rejects.toBeInstanceOf(
      AttachmentUnavailable,
    );
  });

  test("fails when the stored bytes do not match the recorded SHA-256", async () => {
    const { source } = setup(record(), new TextEncoder().encode("tampered"));
    await expect(source.load("certificate-ready", payload)).rejects.toBeInstanceOf(
      AttachmentUnavailable,
    );
  });
});
