import {
  certificateDownloadParamsSchema,
  certificateListResponseSchema,
  certificateVerificationResponseSchema,
  certificateVerifyParamsSchema,
  reissueCertificateRequestSchema,
  reissuedCertificateSchema,
  revokeCertificateRequestSchema,
  revokedCertificateSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class CertificateListResponseDto extends createZodDto(certificateListResponseSchema) {}
export class CertificateDownloadParamsDto extends createZodDto(certificateDownloadParamsSchema) {}
export class CertificateVerifyParamsDto extends createZodDto(certificateVerifyParamsSchema) {}
export class CertificateVerificationResponseDto extends createZodDto(
  certificateVerificationResponseSchema,
) {}
export class RevokeCertificateRequestDto extends createZodDto(revokeCertificateRequestSchema) {}
export class ReissueCertificateRequestDto extends createZodDto(reissueCertificateRequestSchema) {}
export class RevokedCertificateDto extends createZodDto(revokedCertificateSchema) {}
export class ReissuedCertificateDto extends createZodDto(reissuedCertificateSchema) {}
