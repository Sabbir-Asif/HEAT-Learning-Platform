import type { CertificateConfig } from "./certificate-config";
import { generateCertificateNumber } from "./certificate-number";
import type {
  CertificateLog,
  CertificateSource,
  CertificateStorage,
  CertificateStore,
  PdfRenderer,
} from "./certificate-ports";
import { decideIssue, type ExistingCertificate } from "./issue-rules";
import { renderCertificateHtml } from "./render-certificate-html";

export const NUMBER_ATTEMPTS = 5;

export type CertificateOutcome =
  | { status: "issued"; certificateId: string }
  | { status: "resumed"; certificateId: string }
  | { status: "noop"; reason: string }
  | { status: "held"; reason: string }
  | { status: "not-eligible"; reason: string }
  | { status: "duplicate" };

export interface CertificateJobDependencies {
  store: CertificateStore;
  renderer: PdfRenderer;
  storage: CertificateStorage;
  log: CertificateLog;
  config: CertificateConfig;
  now: () => Date;
  newNumber?: () => string;
}

export class CertificateJob {
  constructor(private readonly dependencies: CertificateJobDependencies) {}

  async run(enrollmentId: string, finalAttempt: boolean): Promise<CertificateOutcome> {
    try {
      return await this.process(enrollmentId);
    } catch (error) {
      const fields = { enrollmentId, cause: error instanceof Error ? error.name : "unknown" };
      if (finalAttempt) this.dependencies.log.error("certificate.failed", fields);
      else this.dependencies.log.info("certificate.retrying", fields);
      throw error;
    }
  }

  private async process(enrollmentId: string): Promise<CertificateOutcome> {
    const { store, log } = this.dependencies;
    const source = await store.load(enrollmentId);
    if (source === null) {
      log.info("certificate.not-eligible", { enrollmentId, reason: "enrollment not found" });
      return { status: "not-eligible", reason: "enrollment not found" };
    }
    const decision = decideIssue({
      enrollmentStatus: source.enrollmentStatus,
      emailVerified: source.emailVerified,
      holderName: source.holderName,
      certificate: source.certificate,
    });
    if (decision.action === "noop") {
      log.info("certificate.noop", { enrollmentId, reason: decision.reason });
      return { status: "noop", reason: decision.reason };
    }
    if (decision.action === "held") {
      log.info("certificate.held", { enrollmentId, reason: decision.reason });
      return { status: "held", reason: decision.reason };
    }
    if (decision.action === "not-eligible") {
      log.info("certificate.not-eligible", { enrollmentId, reason: decision.reason });
      return { status: "not-eligible", reason: decision.reason };
    }
    if (decision.action === "resume") {
      const existing = source.certificate;
      if (existing === null) throw new Error("Certificate to resume is missing");
      return this.finish(source, existing, "resumed");
    }
    const created = await this.insert(source);
    if (created === null) {
      log.info("certificate.duplicate", { enrollmentId });
      return { status: "duplicate" };
    }
    return this.finish(source, created, "issued");
  }

  private async insert(source: CertificateSource): Promise<ExistingCertificate | null> {
    const { store, now, newNumber = generateCertificateNumber } = this.dependencies;
    for (let attempt = 0; attempt < NUMBER_ATTEMPTS; attempt += 1) {
      const result = await store.create({
        enrollmentId: source.enrollmentId,
        number: newNumber(),
        recipientName: source.holderName,
        issuedAt: now(),
      });
      if (result.outcome === "created") return result.certificate;
      if (result.outcome === "duplicate") return null;
    }
    throw new Error("Certificate number collided repeatedly");
  }

  private async finish(
    source: CertificateSource,
    certificate: ExistingCertificate,
    status: "issued" | "resumed",
  ): Promise<CertificateOutcome> {
    const { renderer, storage, store, log, config } = this.dependencies;
    const html = renderCertificateHtml(
      {
        holderName: source.holderName,
        courseTitle: source.courseTitle,
        completedAt: source.completedAt,
        number: certificate.number,
      },
      config,
    );
    const pdf = await renderer.render(html);
    const file = await storage.save(pdf);
    const finalised = await store
      .finalise(certificate.id, file, {
        certificateId: certificate.id,
        enrollmentId: source.enrollmentId,
        userId: source.userId,
        courseTitle: source.courseTitle,
        number: certificate.number,
      })
      .catch(async (error: unknown) => {
        await storage.remove(file.key);
        throw error;
      });
    if (!finalised) {
      await storage.remove(file.key);
      log.info("certificate.duplicate", { enrollmentId: source.enrollmentId });
      return { status: "duplicate" };
    }
    log.info(`certificate.${status}`, {
      enrollmentId: source.enrollmentId,
      certificateId: certificate.id,
    });
    return { status, certificateId: certificate.id };
  }
}
