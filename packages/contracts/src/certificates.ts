import { z } from "zod";

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
