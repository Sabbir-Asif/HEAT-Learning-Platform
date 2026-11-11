import { describe, expect, test, vi } from "vitest";
import { loadCertificateConfig } from "../../src/certificate/certificate-config";
import { CertificateJob, NUMBER_ATTEMPTS } from "../../src/certificate/certificate-job";
import type {
  CertificateSource,
  CertificateStorage,
  CertificateStore,
  CreateOutcome,
  IssuedEvent,
  NewCertificate,
  PdfRenderer,
  StoredFile,
} from "../../src/certificate/certificate-ports";
import { sha256Of } from "../../src/certificate/local-certificate-storage";
import type { ExistingCertificate } from "../../src/certificate/issue-rules";

const enrollmentId = "0194f3a0-0000-7000-8000-000000000001";
const holderName = "Amina Rahman";

class MemoryStore implements CertificateStore {
  certificate: (ExistingCertificate & { recipientName: string }) | null = null;
  events: IssuedEvent[] = [];
  takenNumbers = new Set<string>();
  createCalls = 0;
  source: CertificateSource = {
    enrollmentId,
    userId: "0194f3a0-0000-7000-8000-000000000002",
    courseId: "0194f3a0-0000-7000-8000-000000000003",
    courseTitle: "Gender Safety Basics",
    holderName,
    enrollmentStatus: "COMPLETED",
    emailVerified: true,
    completedAt: new Date("2026-11-10T08:00:00.000Z"),
    certificate: null,
  };
  missing = false;
  finaliseError: Error | null = null;

  async load(): Promise<CertificateSource | null> {
    await Promise.resolve();
    if (this.missing) return null;
    return { ...this.source, certificate: this.certificate };
  }

  async create(input: NewCertificate): Promise<CreateOutcome> {
    await Promise.resolve();
    this.createCalls += 1;
    if (this.certificate !== null) return { outcome: "duplicate" };
    if (this.takenNumbers.has(input.number)) return { outcome: "number-taken" };
    this.certificate = {
      id: "certificate-id",
      number: input.number,
      recipientName: input.recipientName,
      fileKey: null,
      fileSha256: null,
      fileSizeBytes: null,
      revokedAt: null,
    };
    return { outcome: "created", certificate: this.certificate };
  }

  async finalise(_id: string, file: StoredFile, event: IssuedEvent): Promise<boolean> {
    await Promise.resolve();
    if (this.finaliseError !== null) throw this.finaliseError;
    if (this.certificate === null) return false;
    if (this.certificate.fileKey !== null) return false;
    this.certificate.fileKey = file.key;
    this.certificate.fileSha256 = file.sha256;
    this.certificate.fileSizeBytes = file.sizeBytes;
    this.events.push(event);
    return true;
  }
}

class MemoryStorage implements CertificateStorage {
  files = new Map<string, Uint8Array>();
  private counter = 0;

  async save(bytes: Uint8Array): Promise<StoredFile> {
    await Promise.resolve();
    this.counter += 1;
    const key = `key-${String(this.counter)}.pdf`;
    this.files.set(key, bytes);
    return { key, sha256: sha256Of(bytes), sizeBytes: bytes.byteLength };
  }

  async remove(key: string): Promise<void> {
    await Promise.resolve();
    this.files.delete(key);
  }
}

const pdfBytes = new TextEncoder().encode("%PDF-1.7 rendered");

const setup = (overrides: { renderer?: PdfRenderer; newNumber?: () => string } = {}) => {
  const store = new MemoryStore();
  const storage = new MemoryStorage();
  const renderer: PdfRenderer = overrides.renderer ?? {
    render: vi.fn().mockResolvedValue(pdfBytes),
  };
  const logs: string[] = [];
  const log = {
    info: (event: string, fields: Record<string, string>) =>
      logs.push(JSON.stringify({ event, ...fields })),
    error: (event: string, fields: Record<string, string>) =>
      logs.push(JSON.stringify({ event, ...fields })),
  };
  const job = new CertificateJob({
    store,
    renderer,
    storage,
    log,
    config: loadCertificateConfig({}),
    now: () => new Date("2026-11-12T00:00:00.000Z"),
    newNumber: overrides.newNumber,
  });
  return { store, storage, renderer, logs, job };
};

describe("CertificateJob issuing", () => {
  test("creates one certificate and one file whose hash matches the bytes", async () => {
    const { store, storage, job, renderer } = setup();

    const outcome = await job.run(enrollmentId, false);

    expect(outcome).toEqual({ status: "issued", certificateId: "certificate-id" });
    expect(store.certificate?.recipientName).toBe(holderName);
    expect(storage.files.size).toBe(1);
    const [key, bytes] = [...storage.files.entries()][0] ?? ["", new Uint8Array()];
    expect(store.certificate?.fileKey).toBe(key);
    expect(store.certificate?.fileSha256).toBe(sha256Of(bytes));
    expect(store.certificate?.fileSizeBytes).toBe(bytes.byteLength);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  test("renders the stored number, name and course into the html", async () => {
    const render = vi.fn().mockResolvedValue(pdfBytes);
    const { store, job } = setup({ renderer: { render } });

    await job.run(enrollmentId, false);

    const html = render.mock.calls[0]?.[0] as string;
    expect(html).toContain(holderName);
    expect(html).toContain("Gender Safety Basics");
    expect(html).toContain(store.certificate?.number ?? "missing");
  });

  test("emits the issued event with ids and the number only after the file is stored", async () => {
    const { store, job } = setup();
    await job.run(enrollmentId, false);
    expect(store.events).toEqual([
      {
        certificateId: "certificate-id",
        enrollmentId,
        userId: store.source.userId,
        courseTitle: "Gender Safety Basics",
        number: store.certificate?.number,
      },
    ]);
  });

  test("a duplicate delivery after completion creates nothing new", async () => {
    const { store, storage, job } = setup();
    await job.run(enrollmentId, false);

    const second = await job.run(enrollmentId, false);

    expect(second).toEqual({ status: "noop", reason: "certificate already issued" });
    expect(storage.files.size).toBe(1);
    expect(store.events).toHaveLength(1);
    expect(store.createCalls).toBe(1);
  });

  test("resumes after a crash between the row insert and the file write", async () => {
    const render = vi
      .fn()
      .mockRejectedValueOnce(new Error("chromium crashed"))
      .mockResolvedValue(pdfBytes);
    const { store, storage, job } = setup({ renderer: { render } });

    await expect(job.run(enrollmentId, false)).rejects.toThrow("chromium crashed");
    const insertedNumber = store.certificate?.number;
    expect(store.certificate?.fileKey).toBeNull();
    expect(storage.files.size).toBe(0);

    const retried = await job.run(enrollmentId, false);

    expect(retried).toEqual({ status: "resumed", certificateId: "certificate-id" });
    expect(store.certificate?.number).toBe(insertedNumber);
    expect(store.createCalls).toBe(1);
    expect(store.certificate?.fileKey).not.toBeNull();
    expect(store.events).toHaveLength(1);
  });

  test("the losing job of a unique violation ends without error", async () => {
    const { store, storage, job, renderer } = setup();
    store.create = vi.fn().mockResolvedValue({ outcome: "duplicate" });

    const outcome = await job.run(enrollmentId, true);

    expect(outcome).toEqual({ status: "duplicate" });
    expect(renderer.render).not.toHaveBeenCalled();
    expect(storage.files.size).toBe(0);
  });

  test("two jobs running at once leave exactly one certificate and one file", async () => {
    const { store, storage, job } = setup();

    const outcomes = await Promise.all([
      job.run(enrollmentId, false),
      job.run(enrollmentId, false),
    ]);

    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(["duplicate", "issued"]);
    expect(storage.files.size).toBe(1);
    expect(store.events).toHaveLength(1);
  });

  test("two jobs resuming the same incomplete certificate store one file", async () => {
    const { store, storage, job } = setup();
    store.certificate = {
      id: "certificate-id",
      number: "ABCD-EFGH-JKMN",
      recipientName: holderName,
      fileKey: null,
      fileSha256: null,
      fileSizeBytes: null,
      revokedAt: null,
    };

    const outcomes = await Promise.all([
      job.run(enrollmentId, false),
      job.run(enrollmentId, false),
    ]);

    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(["duplicate", "resumed"]);
    expect(storage.files.size).toBe(1);
    expect(store.events).toHaveLength(1);
  });

  test("retries with a new number when the number is taken", async () => {
    const numbers = ["AAAA-AAAA-AAAA", "BBBB-BBBB-BBBB"];
    const { store, job } = setup({ newNumber: () => numbers.shift() ?? "CCCC-CCCC-CCCC" });
    store.takenNumbers.add("AAAA-AAAA-AAAA");

    await job.run(enrollmentId, false);

    expect(store.certificate?.number).toBe("BBBB-BBBB-BBBB");
    expect(store.createCalls).toBe(2);
  });

  test("fails after repeated number collisions", async () => {
    const { store, job } = setup({ newNumber: () => "AAAA-AAAA-AAAA" });
    store.takenNumbers.add("AAAA-AAAA-AAAA");

    await expect(job.run(enrollmentId, false)).rejects.toThrow("collided repeatedly");
    expect(store.createCalls).toBe(NUMBER_ATTEMPTS);
  });

  test("uses a generated number by default", async () => {
    const store = new MemoryStore();
    const job = new CertificateJob({
      store,
      renderer: { render: vi.fn().mockResolvedValue(pdfBytes) },
      storage: new MemoryStorage(),
      log: { info: vi.fn(), error: vi.fn() },
      config: loadCertificateConfig({}),
      now: () => new Date(),
    });
    await job.run(enrollmentId, false);
    expect(store.certificate?.number).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  });

  test("removes the new file when another job finalised first", async () => {
    const { store, storage, job } = setup();
    store.finalise = vi.fn().mockResolvedValue(false);

    const outcome = await job.run(enrollmentId, false);

    expect(outcome).toEqual({ status: "duplicate" });
    expect(storage.files.size).toBe(0);
  });

  test("removes the new file when recording it fails", async () => {
    const { store, storage, job } = setup();
    store.finaliseError = new Error("database down");

    await expect(job.run(enrollmentId, false)).rejects.toThrow("database down");
    expect(storage.files.size).toBe(0);
  });
});

describe("CertificateJob eligibility", () => {
  test("holds the certificate while the email is unverified, then issues it once verified", async () => {
    const { store, storage, job, logs } = setup();
    store.source.emailVerified = false;

    const held = await job.run(enrollmentId, false);

    expect(held).toEqual({ status: "held", reason: "email not verified" });
    expect(store.certificate).toBeNull();
    expect(storage.files.size).toBe(0);
    expect(logs.some((line) => line.includes("certificate.held"))).toBe(true);

    store.source.emailVerified = true;
    const issued = await job.run(enrollmentId, false);

    expect(issued.status).toBe("issued");
    expect(storage.files.size).toBe(1);
  });

  test("does not issue for an enrollment that is not completed and logs the reason", async () => {
    const { store, job, logs, renderer } = setup();
    store.source.enrollmentStatus = "APPROVED";

    const outcome = await job.run(enrollmentId, false);

    expect(outcome).toEqual({ status: "not-eligible", reason: "enrollment not completed" });
    expect(store.certificate).toBeNull();
    expect(renderer.render).not.toHaveBeenCalled();
    expect(logs.join("\n")).toContain("enrollment not completed");
  });

  test("ends with a logged reason when the enrollment does not exist", async () => {
    const { store, job, logs } = setup();
    store.missing = true;

    expect(await job.run(enrollmentId, false)).toEqual({
      status: "not-eligible",
      reason: "enrollment not found",
    });
    expect(logs.join("\n")).toContain("enrollment not found");
  });

  test("keeps the certificate of a removed student untouched", async () => {
    const { store, storage, job, renderer } = setup();
    await job.run(enrollmentId, false);
    const before = JSON.stringify(store.certificate);
    store.source.enrollmentStatus = "REMOVED";

    const outcome = await job.run(enrollmentId, false);

    expect(outcome.status).toBe("noop");
    expect(JSON.stringify(store.certificate)).toBe(before);
    expect(storage.files.size).toBe(1);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });
});

describe("CertificateJob failures", () => {
  test("a render failure before the last attempt is logged as a retry and stores nothing", async () => {
    const render = vi.fn().mockRejectedValue(new Error("Chromium render timed out"));
    const { store, storage, job, logs } = setup({ renderer: { render } });

    await expect(job.run(enrollmentId, false)).rejects.toThrow("timed out");

    expect(storage.files.size).toBe(0);
    expect(store.certificate?.fileKey).toBeNull();
    expect(store.events).toEqual([]);
    expect(logs.join("\n")).toContain("certificate.retrying");
    expect(logs.join("\n")).not.toContain("certificate.failed");
  });

  test("the final failure logs an alertable entry with ids only", async () => {
    const render = vi.fn().mockRejectedValue(new Error(`failed for ${holderName}`));
    const { job, logs } = setup({ renderer: { render } });

    await expect(job.run(enrollmentId, true)).rejects.toThrow();

    const failed = logs.find((line) => line.includes("certificate.failed")) ?? "";
    expect(JSON.parse(failed)).toEqual({
      event: "certificate.failed",
      enrollmentId,
      cause: "Error",
    });
    expect(logs.join("\n")).not.toContain(holderName);
  });

  test("records a non-error rejection as unknown", async () => {
    const render = vi.fn().mockRejectedValue("boom");
    const { job, logs } = setup({ renderer: { render } });

    await expect(job.run(enrollmentId, true)).rejects.toBe("boom");
    expect(logs.join("\n")).toContain('"cause":"unknown"');
  });

  test("succeeds on a later attempt after a Chromium failure", async () => {
    const render = vi
      .fn()
      .mockRejectedValueOnce(new Error("crash"))
      .mockRejectedValueOnce(new Error("crash"))
      .mockResolvedValue(pdfBytes);
    const { store, job } = setup({ renderer: { render } });

    await expect(job.run(enrollmentId, false)).rejects.toThrow();
    await expect(job.run(enrollmentId, false)).rejects.toThrow();
    const outcome = await job.run(enrollmentId, false);

    expect(outcome.status).toBe("resumed");
    expect(store.certificate?.fileKey).not.toBeNull();
  });

  test("logs never carry the holder name", async () => {
    const { job, logs } = setup();
    await job.run(enrollmentId, false);
    expect(logs.join("\n")).not.toContain(holderName);
  });
});
