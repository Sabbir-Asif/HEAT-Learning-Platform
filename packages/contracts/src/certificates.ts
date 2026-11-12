import { z } from "zod";
import { approvalReasonMaxLength } from "./approvals";

export const certificateStatusSchema = z.enum(["READY", "PENDING", "REVOKED"]);

export type CertificateStatus = z.infer<typeof certificateStatusSchema>;

export const certificateDownloadParamsSchema = z.object({
  id: z.uuid(),
});

export type CertificateDownloadParams = z.infer<typeof certificateDownloadParamsSchema>;

export const certificateItemSchema = z.object({
  id: z.uuid().nullable(),
  courseId: z.uuid(),
  courseTitle: z.string(),
  status: certificateStatusSchema,
  number: z.string().max(64).nullable(),
  issuedAt: z.iso.datetime().nullable(),
  verificationUrl: z.url().nullable(),
});

export type CertificateItem = z.infer<typeof certificateItemSchema>;

export const certificateListResponseSchema = z.object({
  certificates: z.array(certificateItemSchema),
});

export type CertificateListResponse = z.infer<typeof certificateListResponseSchema>;

export const dashboardCertificateSchema = z.object({
  id: z.uuid().nullable(),
  status: certificateStatusSchema,
});

export type DashboardCertificate = z.infer<typeof dashboardCertificateSchema>;

export const certificateNumberMaxLength = 64;

export const certificateVerifyParamsSchema = z.object({
  number: z
    .string()
    .trim()
    .min(1)
    .max(certificateNumberMaxLength)
    .regex(/^[A-Za-z0-9-]+$/)
    .transform((value) => value.toUpperCase()),
});

export type CertificateVerifyParams = z.infer<typeof certificateVerifyParamsSchema>;

export const certificateVerificationStatuses = ["VALID", "REVOKED"] as const;

export const certificateVerificationResponseSchema = z.object({
  status: z.enum(certificateVerificationStatuses),
  holderName: z.string(),
  courseTitle: z.string(),
  completedAt: z.iso.datetime(),
});

export type CertificateVerificationResponse = z.infer<typeof certificateVerificationResponseSchema>;

const certificateActionReasonSchema = z
  .string()
  .trim()
  .min(1, "Give a reason.")
  .max(approvalReasonMaxLength, `Use at most ${approvalReasonMaxLength} characters.`);

export const revokeCertificateRequestSchema = z.object({
  reason: certificateActionReasonSchema,
});

export type RevokeCertificateRequest = z.infer<typeof revokeCertificateRequestSchema>;

export const reissueCertificateRequestSchema = z.object({
  reason: certificateActionReasonSchema,
});

export type ReissueCertificateRequest = z.infer<typeof reissueCertificateRequestSchema>;

export const revokedCertificateSchema = z.object({
  id: z.uuid(),
  status: z.literal("REVOKED"),
  revokedAt: z.iso.datetime(),
});

export type RevokedCertificate = z.infer<typeof revokedCertificateSchema>;

export const reissuedCertificateSchema = z.object({
  id: z.uuid(),
  status: z.literal("PENDING"),
});

export type ReissuedCertificate = z.infer<typeof reissuedCertificateSchema>;
