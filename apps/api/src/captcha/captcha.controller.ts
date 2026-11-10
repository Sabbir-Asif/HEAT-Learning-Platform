import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth";
import { CaptchaRequestDto, CaptchaResponseDto } from "./captcha.dto";
import { CaptchaService } from "./captcha.service";

@ApiTags("captcha")
@Controller("captcha")
export class CaptchaController {
  constructor(private readonly captcha: CaptchaService) {}

  @Public()
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: CaptchaResponseDto })
  issue(@Body() body: CaptchaRequestDto): Promise<CaptchaResponseDto> {
    return this.captcha.issue(body.replaces);
  }
}
