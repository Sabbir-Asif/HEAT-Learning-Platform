import { Controller, Get, Header, Param } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth";
import { RateLimit } from "../rate-limit";
import { CertificateVerificationResponseDto, CertificateVerifyParamsDto } from "./certificates.dto";
import { CertificatesService } from "./certificates.service";

@ApiTags("certificates")
@Controller("certificates/verify")
@Public()
@RateLimit("certificateVerify")
export class CertificateVerifyController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get(":number")
  @Header("Cache-Control", "no-store")
  @ApiOkResponse({ type: CertificateVerificationResponseDto })
  verify(@Param() params: CertificateVerifyParamsDto): Promise<CertificateVerificationResponseDto> {
    return this.certificates.verify(params.number);
  }
}
