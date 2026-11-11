import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import { ApiOkResponse, ApiProduces, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { actorOf } from "../audit";
import type { AuditableRequest } from "../audit";
import { RateLimit } from "../rate-limit";
import { applyDownloadHeaders } from "./certificate-download-response";
import type { HeaderResponse } from "./certificate-download-response";
import { CertificateDownloadParamsDto } from "./certificates.dto";
import { CertificatesService } from "./certificates.service";

@ApiTags("certificates")
@Controller("admin/certificates")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class AdminCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @RateLimit("certificateDownload")
  @Get(":id/download")
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "Empty body; Nginx serves the PDF through X-Accel-Redirect",
    content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
  })
  async download(
    @Param() params: CertificateDownloadParamsDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditableRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<void> {
    const headers = await this.certificates.prepareDownload(
      { kind: "admin" },
      params.id,
      actorOf(request, session.userId),
    );
    applyDownloadHeaders(response, headers);
  }
}
