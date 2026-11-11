import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import { CertificateListResponseDto } from "./certificates.dto";
import { CertificatesService } from "./certificates.service";

@ApiTags("certificates")
@Controller("me/certificates")
@Audience("student")
export class MeCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @RateLimit("learningRead")
  @Get()
  @ApiOkResponse({ type: CertificateListResponseDto })
  list(@CurrentSession() session: AuthenticatedSession): Promise<CertificateListResponseDto> {
    return this.certificates.listFor(session.userId);
  }
}
