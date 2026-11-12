import { certificateDownloadParamsSchema, certificateListResponseSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class CertificateListResponseDto extends createZodDto(certificateListResponseSchema) {}
export class CertificateDownloadParamsDto extends createZodDto(certificateDownloadParamsSchema) {}
