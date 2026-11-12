import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import { ApiOkResponse, ApiProduces, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { actorOf } from "../audit";
import type { AuditableRequest } from "../audit";
import { RateLimit } from "../rate-limit";
import { applyDownloadHeaders } from "./certificate-download-response";
import type { HeaderResponse } from "./certificate-download-response";
import { CertificateDownloadParamsDto } from "./certificates.dto";
import { CertificatesService } from "./certificates.service";

const pdfResponse = {
  description: "Empty body; Nginx serves the PDF through X-Accel-Redirect",
  content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
} as const;

@ApiTags("certificates")
@Controller("certificates")
@Audience("student")
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @RateLimit("certificateDownload")
  @Get(":id/download")
  @ApiProduces("application/pdf")
  @ApiOkResponse(pdfResponse)
  async download(
    @Param() params: CertificateDownloadParamsDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditableRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<void> {
    const headers = await this.certificates.prepareDownload(
      { kind: "student", userId: session.userId },
      params.id,
      actorOf(request, session.userId),
    );
    applyDownloadHeaders(response, headers);
  }
}
